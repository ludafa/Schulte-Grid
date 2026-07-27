"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { RotateCcw, Trash2 } from "lucide-react"

type HighlightMode = "none" | "highlight" | "hide"

interface GameRecord {
  id: string
  gridSize: number
  time: number
  date: string
  highlightMode: HighlightMode
}

interface Cell {
  value: number
  clicked: boolean
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const remainingMs = Math.floor((ms % 1000) / 10)
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${remainingMs.toString().padStart(2, "0")}`
  }
  return `${remainingSeconds}.${remainingMs.toString().padStart(2, "0")}`
}

/* ── Flip7 Cell Colors ── */
const CELL_COLORS = [
  "bg-[#E8F6F5] border-[#A8DCD9] text-[#1E8C86]",
  "bg-[#FFF8E7] border-[#FFE47A] text-[#B8960F]",
  "bg-[#FFF0EB] border-[#FFBBA6] text-[#D45233]",
  "bg-[#EFF8FD] border-[#B8DFF7] text-[#3A7DB8]",
  "bg-[#F0FAF6] border-[#B8E6D0] text-[#1E7A4C]",
  "bg-[#F5F0FA] border-[#D8C8F0] text-[#6B4FA0]",
]

const SINGLE_CELL_COLOR = "bg-[#FFF8E7] border-[#FFE47A] text-[#B8960F]"

const DIFFICULTY_LABELS: Record<number, { label: string; emoji: string }> = {
  3: { label: "入门", emoji: "🌱" },
  4: { label: "简单", emoji: "🌿" },
  5: { label: "中等", emoji: "🎯" },
  6: { label: "困难", emoji: "⚡" },
  7: { label: "大师", emoji: "👑" },
}

/* ── 年龄段评分（5×5 基准，其他尺寸等比缩放） ── */
type AgeGroup = "5-6" | "7-11" | "12-17" | "18+"

interface RatingThresholds {
  excellent: number
  good: number
  average: number
  pass: number
}

const AGE_THRESHOLDS: Record<AgeGroup, RatingThresholds> = {
  "5-6":   { excellent: 30, good: 40, average: 48, pass: 55 },
  "7-11":  { excellent: 26, good: 32, average: 40, pass: 45 },
  "12-17": { excellent: 16, good: 18, average: 23, pass: 24 },
  "18+":   { excellent: 12, good: 16, average: 19, pass: 20 },
}

const AGE_LABELS: Record<AgeGroup, string> = {
  "5-6": "5-6岁",
  "7-11": "7-11岁",
  "12-17": "12-17岁",
  "18+": "18+岁",
}

interface Rating {
  level: string
  emoji: string
  textColor: string
  bgColor: string
  borderColor: string
}

function getRating(timeMs: number, gridSize: number, age: AgeGroup): Rating {
  const seconds = timeMs / 1000
  const scale = (gridSize * gridSize) / 25
  const t = AGE_THRESHOLDS[age]

  if (seconds <= t.excellent * scale) return {
    level: "优秀", emoji: "👑",
    textColor: "#B8960F", bgColor: "#FFF8E7", borderColor: "#FFD23F",
  }
  if (seconds <= t.good * scale) return {
    level: "良好", emoji: "🥈",
    textColor: "#1E8C86", bgColor: "#E8F6F5", borderColor: "#2BA8A2",
  }
  if (seconds <= t.average * scale) return {
    level: "中等", emoji: "🥉",
    textColor: "#3A7DB8", bgColor: "#EFF8FD", borderColor: "#5DADE2",
  }
  if (seconds <= t.pass * scale) return {
    level: "及格", emoji: "⚡",
    textColor: "#D45233", bgColor: "#FFF0EB", borderColor: "#EF6C4A",
  }
  return {
    level: "继续加油", emoji: "💪",
    textColor: "#6B9E9B", bgColor: "#E8F6F5", borderColor: "#C5E3E0",
  }
}

const TIMER_COLORS: Record<string, { text: string; border: string; shadow: string }> = {
  "优秀":     { text: "#B8960F", border: "rgba(255,210,63,0.5)",   shadow: "0 4px 20px rgba(255,210,63,0.30)" },
  "良好":     { text: "#1E8C86", border: "rgba(43,168,162,0.5)",   shadow: "0 4px 20px rgba(43,168,162,0.25)" },
  "中等":     { text: "#3A7DB8", border: "rgba(93,173,226,0.5)",   shadow: "0 4px 16px rgba(93,173,226,0.25)" },
  "及格":     { text: "#D45233", border: "rgba(239,108,74,0.5)",   shadow: "0 4px 20px rgba(239,108,74,0.25)" },
  "继续加油": { text: "#6B9E9B", border: "rgba(107,158,155,0.4)",  shadow: "0 2px 8px rgba(0,0,0,0.06)" },
}

function getTimerColor(timeMs: number, gridSize: number, age: AgeGroup) {
  const rating = getRating(timeMs, gridSize, age)
  return TIMER_COLORS[rating.level] ?? TIMER_COLORS["继续加油"]
}

/* ── Flip7 Confetti (10 pieces, varied shapes) ── */
const FLIP7_CONFETTI_COLORS = ["#2BA8A2", "#FFD23F", "#EF6C4A", "#5DADE2", "#FFE47A", "#3CC4BD", "#FF8A6A", "#FFF8E7"]

function ConfettiOverlay({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Array<{ id: number; left: string; delay: string; duration: string; color: string; size: number; r: string }>>([])

  useEffect(() => {
    if (!active) { setPieces([]); return }
    const arr = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      delay: `${Math.random() * 0.8}s`,
      duration: `${3.2 + Math.random() * 1.3}s`,
      color: FLIP7_CONFETTI_COLORS[i % FLIP7_CONFETTI_COLORS.length],
      size: 8 + Math.random() * 16,
      r: Math.random() > 0.5 ? "50%" : "3px",
    }))
    setPieces(arr)
    const t = setTimeout(() => setPieces([]), 5000)
    return () => clearTimeout(t)
  }, [active])

  if (pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden>
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: p.left,
            top: "-20px",
            width: p.size,
            height: p.size * (Math.random() > 0.5 ? 1 : 1.8),
            background: p.color,
            borderRadius: p.r,
            animation: `confetti-fall ${p.duration} ease-in ${p.delay} both`,
          }}
        />
      ))}
    </div>
  )
}

/* ── Sparkles ── */
const SPARKLE_DIRECTIONS = [
  { x: -18, y: -28, e: "✨" },
  { x: 20, y: -22, e: "💫" },
  { x: -5, y: -34, e: "⭐" },
  { x: -22, y: -8, e: "✨" },
  { x: 22, y: -8, e: "💫" },
]

function Sparkles() {
  return (
    <>
      {SPARKLE_DIRECTIONS.map((d, i) => (
        <span
          key={i}
          className="absolute text-xs pointer-events-none select-none"
          style={{
            top: "50%",
            left: "50%",
            animation: `sparkle-out 0.55s ease-out ${i * 0.06}s both`,
            "--sx": `${d.x}px`,
            "--sy": `${d.y}px`,
          } as React.CSSProperties}
        >
          {d.e}
        </span>
      ))}
    </>
  )
}

/* ── Flip7 Retro Ribbon Banner ── */
function RibbonBanner({ text }: { text: string }) {
  return (
    <div className="relative inline-block">
      <div
        className="relative px-8 py-2 z-10"
        style={{
          background: "#FFF8E7",
          border: "3px solid #1E8C86",
          borderRadius: "4px",
        }}
      >
        <span
          className="text-sm font-extrabold tracking-[0.3em] uppercase"
          style={{ color: "#1E8C86" }}
        >
          {text}
        </span>
      </div>
      {/* left tail */}
      <div
        className="absolute top-2 -left-[10px] w-5 h-5 z-0"
        style={{
          background: "#F0EAD0",
          border: "3px solid #1E8C86",
          borderRight: "none",
          transform: "rotate(45deg)",
          borderRadius: "2px 0 0 2px",
        }}
      />
      {/* right tail */}
      <div
        className="absolute top-2 -right-[10px] w-5 h-5 z-0"
        style={{
          background: "#F0EAD0",
          border: "3px solid #1E8C86",
          borderLeft: "none",
          transform: "rotate(-45deg)",
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  )
}

/* ── Fan Cards Logo Background ── */
const FAN_CARD_COLORS = ["#2BA8A2", "#FFD23F", "#EF6C4A", "#5DADE2", "#3CC4BD"]
const FAN_ROTATIONS = [-24, -12, 0, 12, 24]

function FanCardsBackground() {
  return (
    <div className="relative w-40 h-32 mx-auto">
      {FAN_CARD_COLORS.map((color, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-lg border-2 border-[#1E8C86]/30"
          style={{
            background: color,
            transform: `rotate(${FAN_ROTATIONS[i]}deg)`,
            transformOrigin: "bottom center",
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  )
}

/* ── Settings Card wrapper ── */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 max-w-sm mx-auto text-left"
      style={{
        background: "#FFFFFF",
        border: "1px solid #C5E3E0",
        borderLeft: "6px solid #A8DCD9",
        boxShadow: "0 4px 20px rgba(43,168,162,0.10)",
      }}
    >
      {children}
    </div>
  )
}

/* ── Pill Segment Toggle ── */
function SegmentToggle({ options, value, onChange }: {
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-[#C5E3E0] overflow-hidden bg-[#E8F6F5]">
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-4 py-1.5 text-xs font-bold transition-all duration-200",
            value === opt.key
              ? "bg-[#2BA8A2] text-white rounded-full shadow-[0_4px_20px_rgba(43,168,162,0.30)]"
              : "text-[#6B9E9B] hover:text-[#1E8C86]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SchulteGrid() {
  const [gridSize, setGridSize] = useState(3)
  const [cells, setCells] = useState<Cell[]>([])
  const [nextNumber, setNextNumber] = useState(1)
  const [gameState, setGameState] = useState<"idle" | "playing" | "finished">("idle")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [records, setRecords] = useState<GameRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [colorMode, setColorMode] = useState<"rainbow" | "single">("rainbow")
  const [autoHide, setAutoHide] = useState(false)
  const [animationMode, setAnimationMode] = useState<"rich" | "simple">("simple")
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("18+")
  const [wrongClick, setWrongClick] = useState<number | null>(null)
  const [sparkleCell, setSparkleCell] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    const savedRecords = localStorage.getItem("schulte-records")
    if (savedRecords) {
      setRecords(JSON.parse(savedRecords))
    }
  }, [])

  const saveRecord = useCallback((time: number) => {
    const newRecord: GameRecord = {
      id: Date.now().toString(),
      gridSize,
      time,
      date: new Date().toLocaleString("zh-CN"),
      highlightMode: "highlight",
    }
    const updatedRecords = [newRecord, ...records].slice(0, 50)
    setRecords(updatedRecords)
    localStorage.setItem("schulte-records", JSON.stringify(updatedRecords))
  }, [gridSize, records])

  const initGame = useCallback(() => {
    const totalCells = gridSize * gridSize
    const numbers = Array.from({ length: totalCells }, (_, i) => i + 1)
    const shuffled = shuffleArray(numbers)
    setCells(shuffled.map(value => ({ value, clicked: false })))
    setNextNumber(1)
    setGameState("idle")
    setStartTime(null)
    setElapsedTime(0)
    setWrongClick(null)
    setSparkleCell(null)
    setShowConfetti(false)
  }, [gridSize])

  const startGame = useCallback(() => {
    const totalCells = gridSize * gridSize
    const numbers = Array.from({ length: totalCells }, (_, i) => i + 1)
    const shuffled = shuffleArray(numbers)
    setCells(shuffled.map(value => ({ value, clicked: false })))
    setNextNumber(1)
    setGameState("playing")
    setStartTime(Date.now())
    setElapsedTime(0)
    setWrongClick(null)
    setSparkleCell(null)
    setShowConfetti(false)
    setShowHistory(false)
  }, [gridSize])

  useEffect(() => {
    if (gameState !== "playing" || !startTime) return
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)
    return () => clearInterval(timer)
  }, [gameState, startTime])

  const handleCellClick = useCallback((index: number) => {
    if (gameState !== "playing") return
    const cell = cells[index]
    if (cell.clicked) return

    if (cell.value === nextNumber) {
      const newCells = [...cells]
      newCells[index] = { ...cell, clicked: true }
      setCells(newCells)
      setWrongClick(null)
      setSparkleCell(index)
      setTimeout(() => setSparkleCell(null), 600)

      const totalCells = gridSize * gridSize
      if (nextNumber === totalCells) {
        const finalTime = Date.now() - (startTime || Date.now())
        setElapsedTime(finalTime)
        setGameState("finished")
        saveRecord(finalTime)
        setShowConfetti(true)
      } else {
        setNextNumber(n => n + 1)
      }
    } else {
      setWrongClick(index)
      setTimeout(() => setWrongClick(null), 400)
    }
  }, [gameState, cells, nextNumber, gridSize, startTime, saveRecord])

  const deleteRecord = useCallback((id: string) => {
    const updatedRecords = records.filter(r => r.id !== id)
    setRecords(updatedRecords)
    localStorage.setItem("schulte-records", JSON.stringify(updatedRecords))
  }, [records])

  const clearAllRecords = useCallback(() => {
    setRecords([])
    localStorage.removeItem("schulte-records")
  }, [])

  const bestRecord = useMemo(() => {
    const sizeRecords = records.filter(r => r.gridSize === gridSize)
    if (sizeRecords.length === 0) return null
    return sizeRecords.reduce((best, curr) => curr.time < best.time ? curr : best)
  }, [records, gridSize])

  const timerColor = useMemo(() => {
    if (gameState !== "playing") return TIMER_COLORS["优秀"]
    return getTimerColor(elapsedTime, gridSize, ageGroup)
  }, [gameState, elapsedTime, gridSize, ageGroup])

  useEffect(() => { initGame() }, [gridSize, initGame])

  const totalCells = gridSize * gridSize
  const cellTextSize = gridSize <= 3 ? "text-3xl sm:text-4xl" : gridSize <= 4 ? "text-2xl sm:text-3xl" : gridSize <= 5 ? "text-xl sm:text-2xl" : gridSize <= 6 ? "text-lg sm:text-xl" : "text-base sm:text-lg"
  const gridGap = gridSize <= 3 ? "gap-3" : gridSize <= 4 ? "gap-2.5" : gridSize <= 5 ? "gap-2" : gridSize <= 6 ? "gap-1.5" : "gap-1"
  const difficulty = DIFFICULTY_LABELS[gridSize] ?? DIFFICULTY_LABELS[5]

  return (
    <>
      <ConfettiOverlay active={showConfetti} />

      <div className="min-h-screen flex flex-col items-center justify-center py-8 px-4 select-none"
        style={{ background: "#EFF8F7" }}>
        <div className="w-full max-w-[520px]">

          {/* ════════════════════════════════════
              IDLE — Setup Screen
              ════════════════════════════════════ */}
          {gameState === "idle" && (
            <div className="text-center space-y-6">
              {/* ── Logo: Fan Cards + Parallelogram Text + Ribbon ── */}
              <div className="space-y-4">
                <FanCardsBackground />

                {/* Parallelogram title */}
                <div className="flex justify-center">
                  <div
                    className="inline-block px-8 py-2"
                    style={{
                      background: "#FFF8E7",
                      border: "3px solid #1E8C86",
                      transform: "skewX(-6deg) rotate(-3deg)",
                      boxShadow: "0 4px 20px rgba(43,168,162,0.12)",
                    }}
                  >
                    <div style={{ transform: "skewX(6deg) rotate(3deg)" }}>
                      <span
                        className="text-4xl sm:text-5xl font-extrabold tracking-[0.05em]"
                        style={{ color: "#1E8C86", textShadow: "1px 1px 0 rgba(43,168,162,0.2)" }}
                      >
                        舒尔特
                      </span>
                    </div>
                  </div>
                </div>

                <RibbonBanner text="注意力挑战" />
              </div>

              {/* ── Difficulty ── */}
              <SettingsCard>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[#6B9E9B] tracking-wide">难度</span>
                  <span className="text-xl font-extrabold text-[#1E8C86]">
                    {gridSize}×{gridSize}
                    <span className="ml-1.5">{difficulty.emoji}</span>
                    <span className="ml-1 text-xs font-bold text-[#6B9E9B]">{difficulty.label}</span>
                  </span>
                </div>
                <Slider
                  value={gridSize}
                  onValueChange={(v) => setGridSize(v as number)}
                  min={3}
                  max={7}
                  step={1}
                />
                <div className="flex justify-between text-xs text-[#A0C8C5] mt-1.5 font-bold">
                  <span>3×3</span>
                  <span>7×7</span>
                </div>
              </SettingsCard>

              {/* ── Options ── */}
              <SettingsCard>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#6B9E9B] tracking-wide">方块颜色</span>
                    <SegmentToggle
                      options={[{ key: "rainbow", label: "🌈 多彩" }, { key: "single", label: "🎨 单色" }]}
                      value={colorMode}
                      onChange={(v) => setColorMode(v as "rainbow" | "single")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#6B9E9B] tracking-wide">点击后</span>
                    <SegmentToggle
                      options={[{ key: "highlight", label: "✨ 高亮" }, { key: "hide", label: "👻 消失" }]}
                      value={autoHide ? "hide" : "highlight"}
                      onChange={(v) => setAutoHide(v === "hide")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#6B9E9B] tracking-wide">动画</span>
                    <SegmentToggle
                      options={[{ key: "simple", label: "⚡ 简易" }, { key: "rich", label: "🎬 丰富" }]}
                      value={animationMode}
                      onChange={(v) => setAnimationMode(v as "rich" | "simple")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#6B9E9B] tracking-wide">年龄</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(AGE_LABELS) as AgeGroup[]).map((age) => (
                        <button
                          key={age}
                          onClick={() => setAgeGroup(age)}
                          className={cn(
                            "px-2.5 py-1.5 text-xs font-bold rounded-full transition-all duration-200",
                            ageGroup === age
                              ? "bg-[#FFD23F] text-[#5C4A1E] shadow-[0_4px_20px_rgba(255,210,63,0.40)]"
                              : "bg-[#E8F6F5] text-[#6B9E9B] hover:bg-[#C5E3E0]",
                          )}
                        >
                          {AGE_LABELS[age]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* ── Gold CTA ── */}
              <button
                onClick={startGame}
                className={cn(
                  "block mx-auto relative text-2xl sm:text-3xl font-extrabold h-auto py-5 px-14 rounded-full",
                  "text-[#5C4A1E] active:scale-95 transition-transform duration-150",
                  "overflow-hidden",
                )}
                style={{
                  background: "linear-gradient(135deg, #FFD23F 0%, #FFE47A 50%, #FFD23F 100%)",
                  boxShadow: "0 4px 20px rgba(255,210,63,0.40), 0 2px 0 #E6B800",
                }}
              >
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%)",
                    borderRadius: "9999px",
                  }}
                />
                <span className="relative z-10">开始挑战</span>
              </button>

              {/* ── Best Record ── */}
              {bestRecord && (
                <div
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold"
                  style={{
                    background: "#FFF8E7",
                    border: "2px solid #FFE47A",
                    color: "#B8960F",
                    boxShadow: "0 4px 20px rgba(255,210,63,0.20)",
                  }}
                >
                  🏆 最佳: {formatTime(bestRecord.time)}s
                </div>
              )}

              {/* ── History ── */}
              <div className="max-w-sm mx-auto">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs font-bold tracking-wide text-[#A0C8C5] hover:text-[#2BA8A2] transition-colors"
                >
                  {showHistory ? "收起记录 ▲" : "📋 历史记录"}
                </button>
                {showHistory && (
                  <div
                    className="mt-3 rounded-2xl overflow-hidden text-left"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #C5E3E0",
                      boxShadow: "0 4px 20px rgba(43,168,162,0.10)",
                    }}
                  >
                    {records.length === 0 ? (
                      <p className="text-xs text-[#A0C8C5] py-6 text-center font-bold">
                        暂无记录，来挑战第一局吧！
                      </p>
                    ) : (
                      <>
                        {records.slice(0, 10).map((r, i) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between px-4 py-3 text-xs gap-2 hover:bg-[#E8F6F5] transition-colors group border-b border-[#C5E3E0]/50 last:border-b-0"
                          >
                            <span className="text-[#A0C8C5] font-bold w-5">{i + 1}</span>
                            <span className="font-bold text-[#1E8C86]">{r.gridSize}×{r.gridSize}</span>
                            <span className="text-[#A0C8C5] hidden sm:inline">{r.date}</span>
                            <span className="font-extrabold ml-auto" style={{ color: "#2BA8A2" }}>
                              {formatTime(r.time)}s
                            </span>
                            <button
                              onClick={() => deleteRecord(r.id)}
                              className="opacity-0 group-hover:opacity-100 text-[#A0C8C5] hover:text-[#EF6C4A] transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={clearAllRecords}
                          className="w-full text-center text-xs font-bold text-[#A0C8C5] hover:text-[#EF6C4A] py-3 transition-colors border-t border-[#C5E3E0]/50"
                        >
                          清空全部记录
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════
              PLAYING — Game In Progress
              ════════════════════════════════════ */}
          {gameState === "playing" && (
            <div className="space-y-5">
              {/* ── Timer Pill ── */}
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 bg-white rounded-full px-6 py-2.5 transition-all duration-500"
                  style={{
                    border: `2px solid ${timerColor.border}`,
                    boxShadow: timerColor.shadow,
                  }}
                >
                  <span className="text-lg">⏱️</span>
                  <span
                    className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight transition-colors duration-500"
                    style={{ color: timerColor.text }}
                  >
                    {formatTime(elapsedTime)}
                  </span>
                </div>
              </div>

              {/* ── Progress Bar ── */}
              <div className="w-full max-w-xs mx-auto">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-extrabold w-7 text-right tabular-nums" style={{ color: "#2BA8A2" }}>
                    {nextNumber - 1}
                  </span>
                  <div
                    className="flex-1 h-4 rounded-full overflow-hidden"
                    style={{
                      background: "#E8F6F5",
                      border: "1px solid #C5E3E0",
                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${((nextNumber - 1) / totalCells) * 100}%`,
                        background: "linear-gradient(90deg, #2BA8A2, #FFD23F)",
                        boxShadow: "0 0 8px rgba(43,168,162,0.3)",
                      }}
                    />
                  </div>
                  <span className="text-sm text-[#6B9E9B] w-7 tabular-nums">{totalCells}</span>
                </div>
              </div>

              {/* ── Target hint ── */}
              <div className="text-center">
                <span className="text-sm font-bold text-[#6B9E9B] tracking-wide">下一个:</span>
                <span className="ml-2 text-2xl font-extrabold" style={{ color: "#2BA8A2" }}>
                  {nextNumber}
                </span>
              </div>

              {/* ── Grid ── */}
              <div
                className={cn("grid", gridGap)}
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
              >
                {cells.map((cell, index) => {
                  const colorClass = colorMode === "single" ? SINGLE_CELL_COLOR : CELL_COLORS[index % CELL_COLORS.length]
                  const isWrong = wrongClick === index
                  const isSparking = sparkleCell === index && animationMode === "rich"
                  const isHidden = autoHide && cell.clicked
                  const isRich = animationMode === "rich"

                  return (
                    <button
                      key={index}
                      onClick={() => handleCellClick(index)}
                      disabled={cell.clicked}
                      className={cn(
                        "relative aspect-square rounded-2xl sm:rounded-3xl",
                        "border-2 font-extrabold",
                        "flex items-center justify-center",
                        "touch-manipulation",
                        cellTextSize,
                        // Hidden mode
                        isHidden && "opacity-0 pointer-events-none scale-50 transition-all duration-200",
                        // Unclicked
                        !cell.clicked && !isWrong && !isHidden && cn(
                          colorClass,
                          "hover:scale-[1.04] cursor-pointer transition-transform duration-75",
                          "shadow-[0_4px_20px_rgba(43,168,162,0.08)]",
                        ),
                        // Clicked (highlight, rich)
                        cell.clicked && !autoHide && isRich && cn(
                          "bg-[#2BA8A2] border-[#1E8C86] text-white",
                          "shadow-[0_4px_20px_rgba(43,168,162,0.35)]",
                          "animate-[pop-bounce_0.35s_ease-out]",
                        ),
                        // Clicked (highlight, simple)
                        cell.clicked && !autoHide && !isRich && cn(
                          "bg-[#2BA8A2] border-[#1E8C86] text-white",
                          "shadow-[0_4px_20px_rgba(43,168,162,0.25)]",
                          "transition-colors duration-100",
                        ),
                        // Wrong (rich)
                        isWrong && isRich && cn(
                          "animate-[head-shake_0.4s_ease-out]",
                          "bg-[#FFF0EB] border-[#EF6C4A] text-[#D45233]",
                          "shadow-[0_4px_20px_rgba(239,108,74,0.25)]",
                        ),
                        // Wrong (simple)
                        isWrong && !isRich && cn(
                          "bg-[#FFF0EB] border-[#EF6C4A] text-[#D45233]",
                          "transition-colors duration-100",
                        ),
                      )}
                    >
                      {!isHidden && cell.value}
                      {isSparking && !autoHide && <Sparkles />}
                    </button>
                  )
                })}
              </div>

              {/* ── Bottom Buttons ── */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => { setGameState("idle"); initGame() }}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold
                             bg-[#FFF8E7] text-[#B8960F] hover:bg-[#FFE47A]
                             border border-[#FFE47A] transition-all duration-150"
                >
                  换难度
                </button>
                <button
                  onClick={startGame}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold
                             bg-[#E8F6F5] text-[#6B9E9B] hover:bg-[#C5E3E0] hover:text-[#1E8C86]
                             border border-[#C5E3E0] transition-all duration-150"
                >
                  <RotateCcw className="w-4 h-4" />
                  重新来
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════
              FINISHED — Victory Celebration
              ════════════════════════════════════ */}
          {gameState === "finished" && (() => {
            const rating = getRating(elapsedTime, gridSize, ageGroup)
            const isExcellent = rating.level === "优秀"
            return (
            <div className="text-center space-y-6">
              {/* ── Crown / Emoji ── */}
              <div
                className="inline-block"
                style={{ animation: isExcellent ? "crown-bounce 1.5s ease-in-out infinite" : undefined }}
              >
                <span className="text-7xl sm:text-8xl">{rating.emoji}</span>
              </div>

              {/* ── Rating Badge ── */}
              <div
                className="inline-flex items-center gap-2 border-2 rounded-full px-7 py-3"
                style={{
                  background: rating.bgColor,
                  borderColor: rating.borderColor,
                  boxShadow: isExcellent
                    ? "0 4px 20px rgba(255,210,63,0.40)"
                    : "0 4px 20px rgba(43,168,162,0.15)",
                  animation: isExcellent ? "glow-pulse 2s ease-in-out infinite" : undefined,
                }}
              >
                <span className="text-2xl">{rating.emoji}</span>
                <span
                  className="text-xl sm:text-2xl font-extrabold"
                  style={{ color: rating.textColor }}
                >
                  {rating.level}！
                </span>
              </div>

              {/* ── Time ── */}
              <div className="space-y-1">
                <p className="text-4xl sm:text-5xl font-extrabold tracking-tight" style={{ color: "#1E8C86" }}>
                  {formatTime(elapsedTime)}
                  <span className="text-lg font-bold text-[#6B9E9B] ml-1">秒</span>
                </p>
                <p className="text-sm font-bold text-[#A0C8C5]">
                  {gridSize}×{gridSize} · {AGE_LABELS[ageGroup]}
                </p>
              </div>

              {/* ── Action Buttons ── */}
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <button
                  onClick={startGame}
                  className={cn(
                    "relative text-xl font-extrabold h-auto py-4 px-10 rounded-full",
                    "text-white active:scale-95 transition-transform duration-150",
                    "overflow-hidden",
                  )}
                  style={{
                    background: "linear-gradient(135deg, #2BA8A2 0%, #3CC4BD 100%)",
                    boxShadow: "0 4px 20px rgba(43,168,162,0.30), 0 2px 0 #1E8C86",
                  }}
                >
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
                      borderRadius: "9999px",
                    }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <RotateCcw className="w-5 h-5" />
                    再来一次
                  </span>
                </button>
                <button
                  onClick={() => { setGameState("idle"); initGame() }}
                  className="text-base font-bold rounded-full h-auto py-3 px-8
                             bg-white text-[#1E8C86] border-2 border-[#C5E3E0]
                             hover:border-[#2BA8A2] hover:text-[#2BA8A2]
                             transition-all duration-150"
                  style={{ boxShadow: "0 4px 20px rgba(43,168,162,0.08)" }}
                >
                  换一个难度
                </button>
              </div>
            </div>
            )
          })()}

        </div>
      </div>
    </>
  )
}
