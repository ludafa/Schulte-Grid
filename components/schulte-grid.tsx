"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { RotateCcw, Trash2, Flower2 } from "lucide-react"

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

/* ── 花园花色：点对后绽放的颜色 ── */
const FLOWER_COLORS: Array<{ bg: string; border: string; text: string }> = [
  { bg: "#F4A825", border: "#D4950F", text: "#FFFFFF" },
  { bg: "#7E57C2", border: "#5E3AA3", text: "#FFFFFF" },
  { bg: "#E8637A", border: "#C94A5E", text: "#FFFFFF" },
  { bg: "#5C9CE5", border: "#3D7CC8", text: "#FFFFFF" },
  { bg: "#FCD34D", border: "#D4A81D", text: "#5D4037" },
  { bg: "#81B29A", border: "#5F9179", text: "#FFFFFF" },
]

const SINGLE_FLOWER = { bg: "#F4A825", border: "#D4950F", text: "#FFFFFF" }

/* ── 泥土色（未点击格子） ── */
const SOIL_CELL = "bg-[#C4956A] border-[#A0764F] text-[#FFFEF7] shadow-inner"
const SOIL_HOVER = "hover:bg-[#D0A87A] hover:border-[#B0885F] hover:shadow-md"

const DIFFICULTY_EMOJI: Record<number, string> = {
  3: "🌱", 4: "🌿", 5: "🌳", 6: "🦊", 7: "🦁",
}

const MASGOT_EMOJIS = ["🌻", "🐝", "🐰", "🐱", "🦋"]
const MASGOT_QUOTES = [
  "找到数字 {n} ！",
  "下一个是 {n} 哦～",
  "点一点数字 {n} 吧！",
  "数字 {n} 在哪里呀？",
  "宝宝找找 {n} ！",
]

/* ── 年龄段评分 ── */
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
  "5-6": "👶 5-6岁",
  "7-11": "🧒 7-11岁",
  "12-17": "🧑 12-17岁",
  "18+": "🧔 18+岁",
}

interface Rating {
  level: string
  emoji: string
  bgClass: string
  textClass: string
}

function getRating(timeMs: number, gridSize: number, age: AgeGroup): Rating {
  const seconds = timeMs / 1000
  const scale = (gridSize * gridSize) / 25
  const t = AGE_THRESHOLDS[age]

  if (seconds <= t.excellent * scale) return { level: "优秀", emoji: "🌸", bgClass: "bg-yellow-50 border-yellow-300", textClass: "text-yellow-700" }
  if (seconds <= t.good * scale)     return { level: "良好", emoji: "🌼", bgClass: "bg-green-50 border-green-300", textClass: "text-green-700" }
  if (seconds <= t.average * scale)  return { level: "中等", emoji: "🌿", bgClass: "bg-blue-50 border-blue-300", textClass: "text-blue-700" }
  if (seconds <= t.pass * scale)     return { level: "及格", emoji: "🌱", bgClass: "bg-orange-50 border-orange-300", textClass: "text-orange-700" }
  return { level: "继续加油", emoji: "💧", bgClass: "bg-pink-50 border-pink-300", textClass: "text-pink-700" }
}

const TIMER_COLORS: Record<string, { text: string; border: string }> = {
  "优秀":     { text: "#66BB6A", border: "rgba(102,187,106,0.4)" },
  "良好":     { text: "#81B29A", border: "rgba(129,178,154,0.4)" },
  "中等":     { text: "#F4A825", border: "rgba(244,168,37,0.4)" },
  "及格":     { text: "#E8833A", border: "rgba(232,131,58,0.4)" },
  "继续加油": { text: "#E8637A", border: "rgba(232,99,122,0.4)" },
}

function getTimerColor(timeMs: number, gridSize: number, age: AgeGroup) {
  const rating = getRating(timeMs, gridSize, age)
  return TIMER_COLORS[rating.level] ?? TIMER_COLORS["继续加油"]
}

/* ── 纸屑庆祝 ── */
function ConfettiOverlay({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Array<{ id: number; left: string; delay: string; duration: string; color: string; size: number; r: string }>>([])

  useEffect(() => {
    if (!active) { setPieces([]); return }
    const colors = ["#F4A825", "#E8637A", "#7E57C2", "#81B29A", "#5C9CE5", "#FCD34D"]
    const arr = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 1.5}s`,
      duration: `${2.5 + Math.random() * 3}s`,
      color: colors[i % colors.length],
      size: 7 + Math.random() * 12,
      r: Math.random() > 0.5 ? "50%" : "2px",
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
            top: "-16px",
            width: p.size,
            height: p.size * (Math.random() > 0.5 ? 1 : 1.6),
            background: p.color,
            borderRadius: p.r,
            animation: `confetti-fall ${p.duration} ease-in ${p.delay} both`,
          }}
        />
      ))}
    </div>
  )
}

/* ── 花朵飞散 ── */
const SPARKLE_DIRECTIONS = [
  { x: -18, y: -28, e: "🌸" },
  { x: 20, y: -22, e: "✨" },
  { x: -5, y: -34, e: "🌼" },
  { x: -22, y: -8, e: "✨" },
  { x: 22, y: -8, e: "🌺" },
]

function Sparkles({ index }: { index: number }) {
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
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("5-6")
  const [wrongClick, setWrongClick] = useState<number | null>(null)
  const [sparkleCell, setSparkleCell] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [masgotEmoji] = useState(() => MASGOT_EMOJIS[Math.floor(Math.random() * MASGOT_EMOJIS.length)])
  const [quoteIndex, setQuoteIndex] = useState(0)

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
    setQuoteIndex(0)
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
    setQuoteIndex(0)
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
        setQuoteIndex(i => (i + 1) % MASGOT_QUOTES.length)
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
  const currentQuote = MASGOT_QUOTES[quoteIndex].replace("{n}", String(nextNumber))
  const cellTextSize = gridSize <= 3 ? "text-3xl sm:text-4xl" : gridSize <= 4 ? "text-2xl sm:text-3xl" : gridSize <= 5 ? "text-xl sm:text-2xl" : gridSize <= 6 ? "text-lg sm:text-xl" : "text-base sm:text-lg"
  const gridGap = gridSize <= 3 ? "gap-3" : gridSize <= 4 ? "gap-2.5" : gridSize <= 5 ? "gap-2" : gridSize <= 6 ? "gap-1.5" : "gap-1"

  return (
    <>
      <ConfettiOverlay active={showConfetti} />

      <div className="min-h-screen flex flex-col items-center justify-center py-6 px-4 select-none">
        <div className="w-full max-w-[520px]">

          {/* ═══ IDLE — 花园入口 ═══ */}
          {gameState === "idle" && (
            <div className="text-center space-y-6">
              {/* 花园守护者 */}
              <div className="relative inline-block">
                <div
                  className="text-7xl sm:text-8xl drop-shadow-sm"
                  style={{ animation: "mascot-bounce 1.8s ease-in-out infinite" }}
                >
                  {masgotEmoji}
                </div>
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xl opacity-60"
                  style={{ animation: "leaf-sway 2.5s ease-in-out infinite" }}
                >
                  🌿
                </div>
              </div>

              {/* 标题 */}
              <div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-primary drop-shadow-sm tracking-tight">
                  数字小花园
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mt-2 font-medium">
                  按顺序从 1 点到 {totalCells}，让花儿一朵一朵绽放 🌸
                </p>
              </div>

              {/* 花圃大小 */}
              <div className="bg-card/90 backdrop-blur-sm rounded-2xl px-5 py-4 border border-border shadow-sm max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-muted-foreground">花圃大小</span>
                  <span className="text-xl font-extrabold text-primary">
                    {gridSize}×{gridSize} <span className="text-base">{DIFFICULTY_EMOJI[gridSize] ?? ""}</span>
                  </span>
                </div>
                <Slider
                  value={[gridSize]}
                  onValueChange={([v]) => setGridSize(v)}
                  min={3}
                  max={7}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground/60 mt-1.5 font-medium">
                  <span>🌱 小花园</span>
                  <span>🌳 大花园</span>
                </div>
              </div>

              {/* 设置 */}
              <div className="bg-card/90 backdrop-blur-sm rounded-2xl px-5 py-3 border border-border shadow-sm max-w-sm mx-auto space-y-3">
                {/* 花色 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">花朵颜色</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setColorMode("rainbow")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all duration-200",
                        colorMode === "rainbow"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      🌈 百花
                    </button>
                    <button
                      onClick={() => setColorMode("single")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all duration-200",
                        colorMode === "single"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      🌻 金盏
                    </button>
                  </div>
                </div>

                {/* 点击后 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">点击后</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setAutoHide(false)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all duration-200",
                        !autoHide
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      ✨ 高亮
                    </button>
                    <button
                      onClick={() => setAutoHide(true)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all duration-200",
                        autoHide
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      👻 消失
                    </button>
                  </div>
                </div>

                {/* 动画 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">动画</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setAnimationMode("simple")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all duration-200",
                        animationMode === "simple"
                          ? "bg-mint text-white shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      ⚡ 简易
                    </button>
                    <button
                      onClick={() => setAnimationMode("rich")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all duration-200",
                        animationMode === "rich"
                          ? "bg-mint text-white shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      🎬 丰富
                    </button>
                  </div>
                </div>

                {/* 年龄 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted-foreground">年龄</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(AGE_LABELS) as AgeGroup[]).map((age) => (
                      <button
                        key={age}
                        onClick={() => setAgeGroup(age)}
                        className={cn(
                          "px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                          ageGroup === age
                            ? "bg-secondary text-secondary-foreground shadow-sm ring-1 ring-border"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {AGE_LABELS[age]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 开始按钮 */}
              <Button
                onClick={startGame}
                size="lg"
                className="text-2xl sm:text-3xl font-extrabold h-auto py-5 px-12 rounded-full
                           bg-accent hover:bg-[#6A45B0] text-accent-foreground shadow-lg
                           active:scale-95 transition-transform gap-2"
              >
                <Flower2 className="w-7 h-7" />
                开始种花！
              </Button>

              {/* 花园日记 */}
              <div className="max-w-sm mx-auto">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {showHistory ? "收起记录 ▲" : "📋 花园日记"}
                </button>
                {showHistory && (
                  <div className="mt-3 border border-border rounded-xl divide-y divide-border overflow-hidden bg-card/90 text-left">
                    {records.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 py-4 text-center">花园里还没有记录哦～</p>
                    ) : (
                      <>
                        {records.slice(0, 10).map((r, i) => (
                          <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs gap-2 hover:bg-muted/40 transition-colors group">
                            <span className="text-muted-foreground/40 w-5 tabular-nums">{i + 1}</span>
                            <span className="font-bold">{r.gridSize}×{r.gridSize}</span>
                            <span className="text-muted-foreground/50 hidden sm:inline">{r.date}</span>
                            <span className="font-extrabold text-primary ml-auto tabular-nums">{formatTime(r.time)}s</span>
                            <button onClick={() => deleteRecord(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={clearAllRecords}
                          className="w-full text-center text-xs text-muted-foreground/50 hover:text-destructive py-2 transition-colors"
                        >
                          清空花园日记
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ PLAYING — 种花中 ═══ */}
          {gameState === "playing" && (
            <div className="space-y-5">
              {/* 计时器 */}
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 bg-card/90 backdrop-blur-sm border-2 rounded-full px-5 py-2 shadow-sm transition-colors duration-500"
                  style={{ borderColor: timerColor.border }}
                >
                  <span className="text-sm">⏱️</span>
                  <span
                    className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight transition-colors duration-500"
                    style={{ color: timerColor.text }}
                  >
                    {formatTime(elapsedTime)}
                  </span>
                </div>
              </div>

              {/* 守护者 + 对白 */}
              <div className="flex items-end gap-2 justify-center">
                <span
                  className="text-4xl sm:text-5xl drop-shadow-sm"
                  style={{ animation: "leaf-sway 2s ease-in-out infinite" }}
                >
                  {masgotEmoji}
                </span>
                <div className="relative bg-card rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-md border border-border max-w-[260px]">
                  <p className="text-base sm:text-lg font-bold text-foreground">
                    {currentQuote}
                  </p>
                  <div className="absolute -left-2 bottom-3 w-3 h-3 bg-card border-l border-b border-border rotate-45" />
                </div>
              </div>

              {/* 藤蔓进度 */}
              <div className="w-full max-w-xs mx-auto">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-primary w-7 text-right tabular-nums">
                    {nextNumber - 1}
                  </span>
                  <div className="flex-1 h-4 bg-muted/80 rounded-full border border-border overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out relative"
                      style={{
                        width: `${((nextNumber - 1) / totalCells) * 100}%`,
                        background: "linear-gradient(90deg, #81B29A, #66BB6A)",
                      }}
                    >
                      {nextNumber > 1 && (
                        <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 text-xs leading-none">
                          🌱
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground w-7 tabular-nums">
                    {totalCells}
                  </span>
                </div>
              </div>

              {/* 花园网格 */}
              <div
                className={cn("grid", gridGap)}
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
              >
                {cells.map((cell, index) => {
                  const flower = colorMode === "single" ? SINGLE_FLOWER : FLOWER_COLORS[index % FLOWER_COLORS.length]
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
                        // 消失
                        isHidden && "opacity-0 pointer-events-none scale-50 transition-all duration-200",
                        // 未点击：泥土花圃
                        !cell.clicked && !isWrong && !isHidden && cn(
                          SOIL_CELL,
                          SOIL_HOVER,
                          "cursor-pointer transition-colors duration-100",
                          "[text-shadow:0_1px_2px_rgba(0,0,0,0.15)]",
                        ),
                        // 已点击 — 丰富开花
                        cell.clicked && !autoHide && isRich && cn(
                          "[animation:flower-bloom_0.4s_ease-out_both]",
                        ),
                        // 已点击 — 简易
                        cell.clicked && !autoHide && !isRich && "transition-all duration-150",
                        // 点错 — 丰富
                        isWrong && isRich && "animate-[head-shake_0.4s_ease-out]",
                        // 点错 — 简易
                        isWrong && !isRich && "transition-colors duration-100",
                      )}
                      style={(() => {
                        if (cell.clicked && !autoHide && !isHidden) {
                          return {
                            background: flower.bg,
                            borderColor: flower.border,
                            color: flower.text,
                            boxShadow: `0 4px 14px ${flower.border}60`,
                            textShadow: flower.text === "#FFFFFF" ? "0 1px 2px rgba(0,0,0,0.15)" : undefined,
                          }
                        }
                        if (isWrong) {
                          return {
                            background: "#F2A5B5",
                            borderColor: "#E8637A",
                            color: "#FFFFFF",
                            boxShadow: "0 4px 12px rgba(232,99,122,0.35)",
                            textShadow: "0 1px 2px rgba(0,0,0,0.15)",
                          }
                        }
                        return undefined
                      })()}
                    >
                      {!isHidden && cell.value}
                      {isSparking && !autoHide && <Sparkles index={index} />}
                    </button>
                  )
                })}
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startGame}
                  className="rounded-full text-muted-foreground text-sm gap-1 font-bold hover:text-foreground"
                >
                  <RotateCcw className="w-4 h-4" />
                  重新来
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setGameState("idle"); initGame() }}
                  className="rounded-full text-muted-foreground text-sm font-bold hover:text-foreground"
                >
                  换花圃
                </Button>
              </div>
            </div>
          )}

          {/* ═══ FINISHED — 花园绽放 ═══ */}
          {gameState === "finished" && (() => {
            const rating = getRating(elapsedTime, gridSize, ageGroup)
            return (
            <div className="text-center space-y-5">
              {/* 庆祝 */}
              <div style={{ animation: "mascot-bounce 0.5s ease-in-out 3" }}>
                <span className="text-7xl sm:text-8xl drop-shadow-md">
                  {rating.emoji === "💧" ? masgotEmoji : "🌸"}
                </span>
              </div>

              {/* 评级 */}
              <div className={cn(
                "inline-flex items-center gap-2 border-2 rounded-full px-6 py-3 shadow-md",
                rating.bgClass, rating.textClass,
              )}>
                <span className="text-2xl">{rating.emoji}</span>
                <span className="text-xl sm:text-2xl font-extrabold">
                  {rating.level}！
                </span>
              </div>

              {/* 成绩 */}
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-extrabold text-primary tabular-nums tracking-tight">
                  {formatTime(elapsedTime)}
                </p>
                <p className="text-sm text-muted-foreground font-medium">
                  {gridSize}×{gridSize} 花圃 · {AGE_LABELS[ageGroup]}
                </p>
                {bestRecord && bestRecord.time <= elapsedTime && (
                  <p className="text-xs text-muted-foreground/50">
                    最佳记录：{formatTime(bestRecord.time)}
                  </p>
                )}
              </div>

              {/* 按钮 */}
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <Button
                  onClick={startGame}
                  size="lg"
                  className="text-xl font-extrabold h-auto py-4 px-10 rounded-full
                             bg-accent hover:bg-[#6A45B0] text-accent-foreground shadow-lg
                             active:scale-95 transition-transform gap-2"
                >
                  <Flower2 className="w-5 h-5" />
                  再种一盆！
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { setGameState("idle"); initGame() }}
                  className="text-base rounded-full h-auto py-3 px-6 font-bold border-2"
                >
                  换一个花圃
                </Button>
              </div>
            </div>
            )
          })()}

        </div>
      </div>
    </>
  )
}
