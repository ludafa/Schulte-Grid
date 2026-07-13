"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
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

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes} min:${remainingSeconds}s`
}

const CELL_COLORS = [
  "bg-[#FFF0E5] border-[#FFD4B8] text-[#CC7A3F]",
  "bg-[#E8F5E9] border-[#B8D4C0] text-[#5C8A6E]",
  "bg-[#E3F2FD] border-[#B3D8F7] text-[#4A7FAD]",
  "bg-[#FFF9C4] border-[#F0E68C] text-[#9B8B30]",
  "bg-[#FCE4EC] border-[#F8BBD0] text-[#C2728A]",
  "bg-[#EDE7F6] border-[#D1C4E9] text-[#7B6BA6]",
]

const SINGLE_CELL_COLOR = "bg-[#FFF8E1] border-[#FFE082] text-[#BF8C30]"

const DIFFICULTY_EMOJI: Record<number, string> = {
  3: "🐣", 4: "🐥", 5: "🐔", 6: "🦊", 7: "🦁",
}

const MASGOT_EMOJIS = ["🧸", "🐻", "🐰", "🐱", "🐶"]
const MASGOT_QUOTES = [
  "找到数字 {n} ！",
  "下一个是 {n} 哦～",
  "点一点数字 {n} 吧！",
  "数字 {n} 在哪里呀？",
  "宝宝找找 {n} ！",
]

/* ── 年龄段评分（5×5 基准，其他尺寸等比缩放） ── */
type AgeGroup = "5-6" | "7-11" | "12-17" | "18+"

interface RatingThresholds {
  excellent: number  // 优秀
  good: number      // 良好
  average: number   // 中等
  pass: number      // 及格
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
  const scale = (gridSize * gridSize) / 25 // 以 5×5 为基准等比缩放
  const t = AGE_THRESHOLDS[age]

  if (seconds <= t.excellent * scale) return { level: "优秀", emoji: "🥇", bgClass: "bg-yellow-50 border-yellow-300", textClass: "text-yellow-700" }
  if (seconds <= t.good * scale)     return { level: "良好", emoji: "🥈", bgClass: "bg-green-50 border-green-300", textClass: "text-green-700" }
  if (seconds <= t.average * scale)  return { level: "中等", emoji: "🥉", bgClass: "bg-blue-50 border-blue-300", textClass: "text-blue-700" }
  if (seconds <= t.pass * scale)     return { level: "及格", emoji: "✅", bgClass: "bg-orange-50 border-orange-300", textClass: "text-orange-700" }
  return { level: "继续加油", emoji: "💪", bgClass: "bg-pink-50 border-pink-300", textClass: "text-pink-700" }
}

/* ── 纸屑庆祝 ── */
function ConfettiOverlay({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Array<{ id: number; left: string; delay: string; duration: string; color: string; size: number; r: string }>>([])

  useEffect(() => {
    if (!active) { setPieces([]); return }
    const colors = ["#FFD93D", "#FF6B9D", "#7EC850", "#FF8C42", "#6BC5FF", "#C084FC"]
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

/* ── 星星飞散 ── */
const SPARKLE_DIRECTIONS = [
  { x: -18, y: -28, e: "⭐" },
  { x: 20, y: -22, e: "✨" },
  { x: -5, y: -34, e: "💫" },
  { x: -22, y: -8, e: "🌟" },
  { x: 22, y: -8, e: "✨" },
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

          {/* ════════════════════════════════════
              IDLE — 开始画面
              ════════════════════════════════════ */}
          {gameState === "idle" && (
            <div className="text-center space-y-6">
              {/* 吉祥物 */}
              <div className="text-7xl sm:text-8xl" style={{ animation: "mascot-bounce 1.5s ease-in-out infinite" }}>
                {masgotEmoji}
              </div>

              {/* 标题 */}
              <div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-[#FF8C42] drop-shadow-sm">
                  找数字 🔢
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground mt-2">
                  按顺序从 1 点到 {totalCells} 哟～
                </p>
              </div>

              {/* 难度滑块 */}
              <div className="bg-white/70 rounded-2xl px-5 py-4 border border-border shadow-sm max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">难度</span>
                  <span className="text-xl font-extrabold text-[#FF8C42]">
                    {gridSize}×{gridSize} {DIFFICULTY_EMOJI[gridSize] ?? ""}
                  </span>
                </div>
                <Slider
                  value={[gridSize]}
                  onValueChange={([v]) => setGridSize(v)}
                  min={3}
                  max={7}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground/60 mt-1.5">
                  <span>🐣 简单</span>
                  <span>🦁 挑战</span>
                </div>
              </div>

              {/* 方块颜色 + 点击效果 */}
              <div className="bg-white/70 rounded-2xl px-5 py-3 border border-border shadow-sm max-w-sm mx-auto space-y-3">
                {/* 颜色模式 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">方块颜色</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setColorMode("rainbow")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        colorMode === "rainbow"
                          ? "bg-[#FF8C42] text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      🌈 多彩
                    </button>
                    <button
                      onClick={() => setColorMode("single")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        colorMode === "single"
                          ? "bg-[#FF8C42] text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      🎨 单色
                    </button>
                  </div>
                </div>

                {/* 点击后效果 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">点击后</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setAutoHide(false)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        !autoHide
                          ? "bg-[#FF6B9D] text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      ✨ 高亮
                    </button>
                    <button
                      onClick={() => setAutoHide(true)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        autoHide
                          ? "bg-[#FF6B9D] text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      👻 消失
                    </button>
                  </div>
                </div>

                {/* 动画模式 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">动画</span>
                  <div className="inline-flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setAnimationMode("simple")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        animationMode === "simple"
                          ? "bg-[#7EC850] text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      ⚡ 简易
                    </button>
                    <button
                      onClick={() => setAnimationMode("rich")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-colors",
                        animationMode === "rich"
                          ? "bg-[#7EC850] text-white"
                          : "bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      🎬 丰富
                    </button>
                  </div>
                </div>

                {/* 年龄区间 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">年龄</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(AGE_LABELS) as AgeGroup[]).map((age) => (
                      <button
                        key={age}
                        onClick={() => setAgeGroup(age)}
                        className={cn(
                          "px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors",
                          ageGroup === age
                            ? "bg-[#FFD93D] text-[#5C4A1E] shadow-sm"
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
                           bg-[#FF8C42] hover:bg-[#FF7728] text-white shadow-lg
                           active:scale-95 transition-transform"
              >
                开始玩！ 🎉
              </Button>

              {/* 历史记录（折叠） */}
              <div className="max-w-sm mx-auto">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {showHistory ? "收起记录 ▲" : "📋 游戏记录"}
                </button>
                {showHistory && (
                  <div className="mt-3 border border-border rounded-xl divide-y divide-border overflow-hidden bg-white/70 text-left">
                    {records.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 py-4 text-center">暂无记录</p>
                    ) : (
                      <>
                        {records.slice(0, 10).map((r, i) => (
                          <div key={r.id} className="flex items-center justify-between px-3 py-2 text-xs gap-2 hover:bg-muted/40 transition-colors group">
                            <span className="text-muted-foreground/40 w-5">{i + 1}</span>
                            <span className="font-bold">{r.gridSize}×{r.gridSize}</span>
                            <span className="text-muted-foreground/50 hidden sm:inline">{r.date}</span>
                            <span className="font-extrabold text-[#FF8C42] ml-auto">{formatTime(r.time)}s</span>
                            <button onClick={() => deleteRecord(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={clearAllRecords}
                          className="w-full text-center text-xs text-muted-foreground/50 hover:text-destructive py-2 transition-colors"
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
              PLAYING — 游戏进行中
              ════════════════════════════════════ */}
          {gameState === "playing" && (
            <div className="space-y-5">
              {/* 吉祥物 + 提示气泡 */}
              <div className="flex items-end gap-2 justify-center">
                <span className="text-4xl sm:text-5xl" style={{ animation: "float-cloud 2s ease-in-out infinite" }}>
                  {masgotEmoji}
                </span>
                <div className="relative bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-md border border-border max-w-[260px]">
                  <p className="text-base sm:text-lg font-bold text-[#4A3728]">
                    {currentQuote}
                  </p>
                  <div className="absolute -left-2 bottom-3 w-3 h-3 bg-white border-l border-b border-border rotate-45" />
                </div>
              </div>

              {/* 进度条 */}
              <div className="w-full max-w-xs mx-auto">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-[#FF8C42] w-7 text-right tabular-nums">
                    {nextNumber - 1}
                  </span>
                  <div className="flex-1 h-4 bg-white/60 rounded-full border border-border overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${((nextNumber - 1) / totalCells) * 100}%`,
                        background: "linear-gradient(90deg, #FFD93D, #FF8C42)",
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-7 tabular-nums">
                    {totalCells}
                  </span>
                </div>
              </div>

              {/* 已消耗时长 */}
              <div className="text-center">
                <span className="text-sm font-bold text-muted-foreground tabular-nums">
                  ⏱ 本局已消耗 {formatElapsed(elapsedTime)}
                </span>
              </div>

              {/* 网格 */}
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
                        // 消失模式
                        isHidden && "opacity-0 pointer-events-none scale-50 transition-all duration-200",
                        // 未点击：彩色 / 单色背景
                        !cell.clicked && !isWrong && !isHidden && cn(
                          colorClass,
                          "shadow-sm hover:shadow-md hover:scale-[1.04] cursor-pointer",
                          "transition-colors duration-75",
                        ),
                        // 已点击（高亮模式 — 丰富动画）
                        cell.clicked && !autoHide && isRich && "bg-[#FF6B9D] border-[#FF4D88] text-white shadow-md animate-[pop-bounce_0.35s_ease-out]",
                        // 已点击（高亮模式 — 简易动画）
                        cell.clicked && !autoHide && !isRich && "bg-[#FF6B9D] border-[#FF4D88] text-white shadow-md transition-colors duration-100",
                        // 点错 — 丰富
                        isWrong && isRich && "animate-[head-shake_0.4s_ease-out] bg-[#FFE0E0] border-[#FF9999] text-[#CC5555]",
                        // 点错 — 简易
                        isWrong && !isRich && "bg-[#FFE0E0] border-[#FF9999] text-[#CC5555] transition-colors duration-100",
                      )}
                    >
                      {!isHidden && cell.value}
                      {isSparking && !autoHide && <Sparkles index={index} />}
                    </button>
                  )
                })}
              </div>

              {/* 下方按钮 */}
              <div className="flex justify-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startGame}
                  className="rounded-full text-muted-foreground text-sm gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  重新来
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setGameState("idle"); initGame() }}
                  className="rounded-full text-muted-foreground text-sm"
                >
                  换难度
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════
              FINISHED — 完成庆祝
              ════════════════════════════════════ */}
          {gameState === "finished" && (() => {
            const rating = getRating(elapsedTime, gridSize, ageGroup)
            return (
            <div className="text-center space-y-5">
              {/* 吉祥物 */}
              <div style={{ animation: "mascot-bounce 0.5s ease-in-out 3" }}>
                <span className="text-7xl sm:text-8xl">
                  {rating.emoji === "💪" ? masgotEmoji : "🎉"}
                </span>
              </div>

              {/* 评级徽章 */}
              <div className={cn(
                "inline-flex items-center gap-2 border-2 rounded-full px-6 py-3 shadow-sm",
                rating.bgClass, rating.textClass,
              )}>
                <span className="text-2xl">{rating.emoji}</span>
                <span className="text-xl sm:text-2xl font-extrabold">
                  {rating.level}！
                </span>
              </div>

              {/* 时间 */}
              <p className="text-sm text-muted-foreground/60">
                {formatTime(elapsedTime)} 秒 · {gridSize}×{gridSize} · {AGE_LABELS[ageGroup]}
              </p>

              {/* 按钮 */}
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <Button
                  onClick={startGame}
                  size="lg"
                  className="text-xl font-extrabold h-auto py-4 px-10 rounded-full
                             bg-[#7EC850] hover:bg-[#6BB840] text-white shadow-lg
                             active:scale-95 transition-transform gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  再来一次！
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { setGameState("idle"); initGame() }}
                  className="text-base rounded-full h-auto py-3 px-6"
                >
                  换一个难度
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
