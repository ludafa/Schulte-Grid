"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { RotateCcw, Settings2, Trash2 } from "lucide-react"

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

const CELL_COLORS = [
  "bg-[#FFF0E5] border-[#FFD4B8] text-[#CC7A3F]",
  "bg-[#E8F5E9] border-[#B8D4C0] text-[#5C8A6E]",
  "bg-[#E3F2FD] border-[#B3D8F7] text-[#4A7FAD]",
  "bg-[#FFF9C4] border-[#F0E68C] text-[#9B8B30]",
  "bg-[#FCE4EC] border-[#F8BBD0] text-[#C2728A]",
  "bg-[#EDE7F6] border-[#D1C4E9] text-[#7B6BA6]",
]

const MASGOT_EMOJIS = ["🧸", "🐻", "🐰", "🐱", "🐶"]
const MASGOT_QUOTES = [
  "找到数字 {n} ！",
  "下一个是 {n} 哦～",
  "点一点数字 {n} 吧！",
  "数字 {n} 在哪里呀？",
  "宝宝找找 {n} ！",
]

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
  const [showParentPanel, setShowParentPanel] = useState(false)
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
    setShowParentPanel(false)
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
  const cellTextSize = gridSize <= 3 ? "text-3xl sm:text-4xl" : gridSize <= 4 ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
  const gridGap = gridSize <= 3 ? "gap-3" : gridSize <= 4 ? "gap-2.5" : "gap-2"

  return (
    <>
      <ConfettiOverlay active={showConfetti} />

      <div className="min-h-screen flex flex-col items-center justify-center py-6 px-4 select-none">
        <div className="w-full max-w-[520px]">

          {/* ════════════════════════════════════
              IDLE — 开始画面
              ════════════════════════════════════ */}
          {gameState === "idle" && (
            <div className="text-center space-y-8">
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

              {/* 难度预览 */}
              <div className="inline-flex items-center gap-2 bg-white/70 rounded-full px-5 py-2 border border-border shadow-sm">
                <span className="text-sm text-muted-foreground">难度：</span>
                {gridSize === 3 && <span className="text-lg">🐣 3×3</span>}
                {gridSize === 4 && <span className="text-lg">🐥 4×4</span>}
                {gridSize === 5 && <span className="text-lg">🐔 5×5</span>}
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

              {/* 进度 */}
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-white/60 rounded-full px-4 py-1.5 border border-border">
                  {Array.from({ length: nextNumber - 1 }, (_, i) => (
                    <span key={i}>⭐</span>
                  ))}
                  <span className="font-extrabold text-[#FF8C42]">{nextNumber - 1}</span>
                  <span className="text-muted-foreground">/ {totalCells}</span>
                </span>
              </div>

              {/* 网格 */}
              <div
                className={cn("grid", gridGap)}
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
              >
                {cells.map((cell, index) => {
                  const colorClass = CELL_COLORS[index % CELL_COLORS.length]
                  const isWrong = wrongClick === index
                  const isSparking = sparkleCell === index

                  return (
                    <button
                      key={index}
                      onClick={() => handleCellClick(index)}
                      disabled={cell.clicked}
                      className={cn(
                        "relative aspect-square rounded-2xl sm:rounded-3xl",
                        "border-2 font-extrabold",
                        "flex items-center justify-center",
                        "transition-all duration-150",
                        "active:scale-90",
                        cellTextSize,
                        // 未点击：彩色背景
                        !cell.clicked && !isWrong && cn(
                          colorClass,
                          "shadow-sm hover:shadow-md hover:scale-[1.04] cursor-pointer",
                        ),
                        // 已点击：粉色 + 弹跳
                        cell.clicked && "bg-[#FF6B9D] border-[#FF4D88] text-white shadow-md",
                        cell.clicked && "animate-[pop-bounce_0.35s_ease-out]",
                        // 点错：摇头
                        isWrong && "animate-[head-shake_0.4s_ease-out] bg-[#FFE0E0] border-[#FF9999] text-[#CC5555]",
                      )}
                    >
                      {cell.value}
                      {isSparking && <Sparkles index={index} />}
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
          {gameState === "finished" && (
            <div className="text-center space-y-6">
              {/* 吉祥物 */}
              <div style={{ animation: "mascot-bounce 0.5s ease-in-out 3" }}>
                <span className="text-7xl sm:text-8xl">🎉</span>
              </div>

              {/* 奖杯 */}
              <div className="inline-flex items-center gap-2 bg-yellow-100 border-2 border-yellow-300 rounded-full px-5 py-2">
                <span className="text-2xl">🏆</span>
                <span className="text-xl sm:text-2xl font-extrabold text-[#B8860B]">
                  太厉害了！
                </span>
              </div>

              {/* 时间（小字，不给孩子压力） */}
              <p className="text-sm text-muted-foreground/60">
                用了 {formatTime(elapsedTime)} 秒完成了 {gridSize}×{gridSize}
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
          )}

          {/* ════════════════════════════════════
              家长角落（小齿轮）
              ════════════════════════════════════ */}
          {!showParentPanel && (
            <div className="fixed bottom-4 right-4 z-40">
              <button
                onClick={() => setShowParentPanel(true)}
                className="w-9 h-9 rounded-full bg-white/80 border border-border shadow-sm
                           flex items-center justify-center text-muted-foreground/50
                           hover:text-muted-foreground hover:bg-white transition-colors"
                title="家长设置"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── 家长面板 ── */}
          {showParentPanel && (
            <div className="fixed inset-0 bg-black/20 z-50 flex items-end sm:items-center justify-center p-4"
                 onClick={() => setShowParentPanel(false)}>
              <div
                className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md space-y-5
                           animate-[fade-up_0.25s_ease-out] max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-muted-foreground" />
                    家长设置
                  </h3>
                  <button
                    onClick={() => setShowParentPanel(false)}
                    className="text-muted-foreground hover:text-foreground text-xl leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* 网格大小 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">网格难度</span>
                    <span className="text-lg font-extrabold text-[#FF8C42]">
                      {gridSize}×{gridSize}
                      {gridSize === 3 ? " 🐣" : gridSize === 4 ? " 🐥" : " 🐔"}
                    </span>
                  </div>
                  <Slider
                    value={[gridSize]}
                    onValueChange={([v]) => setGridSize(v)}
                    min={3}
                    max={5}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>简单</span>
                    <span>挑战</span>
                  </div>
                </div>

                {/* 历史记录 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">游戏记录</span>
                    {records.length > 0 && (
                      <button onClick={clearAllRecords} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                        清空
                      </button>
                    )}
                  </div>
                  {records.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 py-4 text-center">暂无记录</p>
                  ) : (
                    <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
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
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => setShowParentPanel(false)}
                  className="w-full rounded-full"
                >
                  关 闭
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
