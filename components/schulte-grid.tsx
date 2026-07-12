"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { Trophy, Clock, RotateCcw, Sparkles, Star, History, Settings2, Play, Trash2 } from "lucide-react"

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
  return `${remainingSeconds}.${remainingMs.toString().padStart(2, "0")}秒`
}

const HIGHLIGHT_MODE_LABELS: Record<HighlightMode, string> = {
  none: "不高亮",
  highlight: "高亮",
  hide: "隐藏",
}

export function SchulteGrid() {
  const [gridSize, setGridSize] = useState(5)
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("highlight")
  const [cells, setCells] = useState<Cell[]>([])
  const [nextNumber, setNextNumber] = useState(1)
  const [gameState, setGameState] = useState<"idle" | "playing" | "finished">("idle")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [records, setRecords] = useState<GameRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(true)
  const [wrongClick, setWrongClick] = useState<number | null>(null)

  // 从 localStorage 加载记录
  useEffect(() => {
    const savedRecords = localStorage.getItem("schulte-records")
    if (savedRecords) {
      setRecords(JSON.parse(savedRecords))
    }
  }, [])

  // 保存记录到 localStorage
  const saveRecord = useCallback((time: number) => {
    const newRecord: GameRecord = {
      id: Date.now().toString(),
      gridSize,
      time,
      date: new Date().toLocaleString("zh-CN"),
      highlightMode,
    }
    const updatedRecords = [newRecord, ...records].slice(0, 50) // 最多保存50条
    setRecords(updatedRecords)
    localStorage.setItem("schulte-records", JSON.stringify(updatedRecords))
  }, [gridSize, highlightMode, records])

  // 初始化游戏
  const initGame = useCallback(() => {
    const totalCells = gridSize * gridSize
    const numbers = Array.from({ length: totalCells }, (_, i) => i + 1)
    const shuffled = shuffleArray(numbers)
    setCells(shuffled.map(value => ({ value, clicked: false })))
    setNextNumber(1)
    setGameState("idle")
    setStartTime(null)
    setElapsedTime(0)
    setShowSettings(true)
    setWrongClick(null)
  }, [gridSize])

  // 开始游戏
  const startGame = useCallback(() => {
    const totalCells = gridSize * gridSize
    const numbers = Array.from({ length: totalCells }, (_, i) => i + 1)
    const shuffled = shuffleArray(numbers)
    setCells(shuffled.map(value => ({ value, clicked: false })))
    setNextNumber(1)
    setGameState("playing")
    setStartTime(Date.now())
    setElapsedTime(0)
    setShowSettings(false)
    setWrongClick(null)
  }, [gridSize])

  // 计时器
  useEffect(() => {
    if (gameState !== "playing" || !startTime) return
    
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 10)
    
    return () => clearInterval(timer)
  }, [gameState, startTime])

  // 处理点击
  const handleCellClick = useCallback((index: number) => {
    if (gameState !== "playing") return
    
    const cell = cells[index]
    if (cell.clicked) return
    
    if (cell.value === nextNumber) {
      const newCells = [...cells]
      newCells[index] = { ...cell, clicked: true }
      setCells(newCells)
      setWrongClick(null)
      
      const totalCells = gridSize * gridSize
      if (nextNumber === totalCells) {
        // 游戏完成
        const finalTime = Date.now() - (startTime || Date.now())
        setElapsedTime(finalTime)
        setGameState("finished")
        saveRecord(finalTime)
      } else {
        setNextNumber(nextNumber + 1)
      }
    } else {
      // 点错了，显示错误动画
      setWrongClick(index)
      setTimeout(() => setWrongClick(null), 300)
    }
  }, [gameState, cells, nextNumber, gridSize, startTime, saveRecord])

  // 删除单条记录
  const deleteRecord = useCallback((id: string) => {
    const updatedRecords = records.filter(r => r.id !== id)
    setRecords(updatedRecords)
    localStorage.setItem("schulte-records", JSON.stringify(updatedRecords))
  }, [records])

  // 清除所有记录
  const clearAllRecords = useCallback(() => {
    setRecords([])
    localStorage.removeItem("schulte-records")
  }, [])

  // 当前网格大小的最佳记录
  const bestRecord = useMemo(() => {
    const sizeRecords = records.filter(r => r.gridSize === gridSize)
    if (sizeRecords.length === 0) return null
    return sizeRecords.reduce((best, curr) => curr.time < best.time ? curr : best)
  }, [records, gridSize])

  // 初始化
  useEffect(() => {
    initGame()
  }, [gridSize, initGame])

  const totalCells = gridSize * gridSize

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2">舒尔特方格</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            按顺序点击数字 <span className="font-semibold text-foreground">1</span> 到 <span className="font-semibold text-foreground">{totalCells}</span>，训练你的注意力
          </p>
        </div>

        {/* 游戏状态栏 - 游戏进行中隐藏 */}
        {gameState !== "playing" && (
          <Card className="mb-4 sm:mb-6 border-2 border-primary/20 shadow-lg">
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
                    <span className="text-xl sm:text-2xl font-mono font-bold text-foreground">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                  {bestRecord && (
                    <div className="hidden sm:flex items-center gap-1 text-accent-foreground bg-accent px-3 py-1 rounded-full">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm font-medium">{formatTime(bestRecord.time)}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowHistory(!showHistory)}
                    className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSettings(!showSettings)}
                    className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
                  >
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 设置面板 - 仅在准备状态显示 */}
        {showSettings && gameState === "idle" && (
          <Card className="mb-6 border-2 border-secondary/30 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-secondary-foreground" />
                游戏设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 网格大小 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">网格大小</span>
                  <span className="text-lg font-bold text-primary">{gridSize} × {gridSize}</span>
                </div>
                <Slider
                  value={[gridSize]}
                  onValueChange={([value]) => setGridSize(value)}
                  min={3}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>3×3 简单</span>
                  <span>10×10 困难</span>
                </div>
              </div>

              {/* 高亮模式 */}
              <div>
                <span className="text-sm font-medium mb-3 block">点击后效果</span>
                <div className="flex gap-2">
                  {(["none", "highlight", "hide"] as HighlightMode[]).map((mode) => (
                    <Button
                      key={mode}
                      variant={highlightMode === mode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setHighlightMode(mode)}
                      className="flex-1"
                    >
                      {HIGHLIGHT_MODE_LABELS[mode]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* 开始按钮 */}
              <Button
                onClick={startGame}
                className="w-full h-12 text-lg font-bold gap-2"
              >
                <Play className="w-5 h-5" />
                开始游戏
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 游戏网格 - 游戏进行中显示，完成后隐藏 */}
        {gameState === "playing" && (
          <Card className="mb-6 border-2 border-primary/20 shadow-xl overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                }}
              >
                {cells.map((cell, index) => {
                  const isHidden = highlightMode === "hide" && cell.clicked
                  const isHighlighted = highlightMode === "highlight" && cell.clicked
                  const isWrong = wrongClick === index
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handleCellClick(index)}
                      disabled={cell.clicked}
                      className={cn(
                        "aspect-square rounded-2xl font-bold transition-all duration-150 transform",
                        "flex items-center justify-center select-none",
                        /* 3D raised tile — hard bottom shadow creates physical depth */
                        "shadow-[0_4px_0_0_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]",
                        "hover:shadow-[0_6px_0_0_rgba(0,0,0,0.08),0_3px_8px_rgba(0,0,0,0.06)]",
                        "active:shadow-[0_1px_0_0_rgba(0,0,0,0.06)] active:scale-[0.97]",
                        gridSize <= 5 ? "text-lg sm:text-2xl" : gridSize <= 7 ? "text-base sm:text-xl" : "text-sm sm:text-lg",
                        isHidden && "opacity-0 pointer-events-none",
                        /* Clicked with highlight: pressed-into-place, soft green */
                        isHighlighted && "bg-emerald-100 text-emerald-700 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] scale-[0.97]",
                        /* Wrong click: red flash + shake */
                        isWrong && "animate-shake bg-red-100 text-red-600 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]",
                        /* Unclicked default: white tile, indigo-tinged border */
                        !cell.clicked && !isWrong && "bg-card text-foreground border border-slate-200/80",
                      )}
                    >
                      {!isHidden && cell.value}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 游戏完成 */}
        {gameState === "finished" && (
          <Card className="mb-4 sm:mb-6 border-2 border-accent bg-accent/20">
            <CardContent className="pt-4 sm:pt-6 text-center">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="relative">
                  <Trophy className="w-12 sm:w-16 h-12 sm:h-16 text-amber-500" />
                  <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">太棒了!</h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-3 sm:mb-4">
                你完成了 {gridSize}×{gridSize} 的挑战
              </p>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-primary mb-4 sm:mb-6">
                {formatTime(elapsedTime)}
              </div>
              {bestRecord && elapsedTime === bestRecord.time && (
                <div className="inline-flex items-center gap-2 bg-accent/20 text-accent-foreground px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-3 sm:mb-4">
                  <Star className="w-4 sm:w-5 h-4 sm:h-5 fill-amber-500 text-amber-500" />
                  <span className="text-sm sm:text-base font-bold">新纪录!</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                <Button onClick={startGame} className="gap-2 text-sm sm:text-base">
                  <RotateCcw className="w-4 h-4" />
                  再来一局
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowSettings(true)
                  setGameState("idle")
                }} className="text-sm sm:text-base">
                  修改设置
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 游戏中重置按钮 */}
        {gameState === "playing" && (
          <div className="flex justify-center gap-2 sm:gap-3 flex-col sm:flex-row">
            <Button variant="outline" onClick={startGame} className="gap-2 text-sm sm:text-base order-2 sm:order-1">
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">重新开始</span>
              <span className="sm:hidden">重新</span>
            </Button>
            <Button variant="ghost" onClick={() => {
              setShowSettings(true)
              setGameState("idle")
            }} className="text-sm sm:text-base order-1 sm:order-2">
              返回
            </Button>
          </div>
        )}

        {/* 历史记录 */}
        {showHistory && (
          <Card className="border-2 border-muted">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-col sm:flex-row gap-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <History className="w-4 sm:w-5 h-4 sm:h-5" />
                  游戏记录
                </CardTitle>
                {records.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllRecords}
                    className="text-destructive hover:text-destructive text-xs sm:text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    清空
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm sm:text-base">
                  还没有游戏记录，快开始你的第一局吧!
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {records.map((record, index) => (
                    <div
                      key={record.id}
                      className={cn(
                        "flex items-center justify-between p-2 sm:p-3 rounded-lg gap-2",
                        "bg-muted/50 hover:bg-muted transition-colors"
                      )}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <span className="text-xs sm:text-sm text-muted-foreground w-5 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold">{record.gridSize}×{record.gridSize}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded">
                              {HIGHLIGHT_MODE_LABELS[record.highlightMode]}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground block">{record.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <span className="font-mono font-bold text-primary text-xs sm:text-sm">
                          {formatTime(record.time)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteRecord(record.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 页脚 */}
        <p className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8">
          舒尔特方格可以有效训练注意力集中能力
        </p>
      </div>

      {/* 错误抖动动画 */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  )
}
