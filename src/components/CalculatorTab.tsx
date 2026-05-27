"use client";

import React, { useState } from "react";
import { Calculator, PieChart, RotateCcw, Delete } from "lucide-react";

type CalcMode = "general" | "equity";

export default function CalculatorTab() {
  const [mode, setMode] = useState<CalcMode>("general");

  // === 일반 계산기 상태 ===
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  // === 주식 지분율 계산기 상태 ===
  const [totalShares, setTotalShares] = useState<string>("");
  const [myShares, setMyShares] = useState<string>("");
  const [newIssuedShares, setNewIssuedShares] = useState<string>("");
  const [newBuyShares, setNewBuyShares] = useState<string>("");

  // ==============================
  // 일반 계산기 로직
  // ==============================
  const handleNumClick = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const handleOpClick = (op: string) => {
    const currentNum = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(currentNum);
      setEquation(`${currentNum} ${op}`);
    } else if (operator) {
      const result = calculate(prevValue, currentNum, operator);
      setPrevValue(result);
      setDisplay(String(result));
      setEquation(`${result} ${op}`);
    }

    setOperator(op);
    setWaitingForNewValue(true);
  };

  const calculate = (a: number, b: number, op: string) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const handleEqual = () => {
    if (operator && prevValue !== null) {
      const currentNum = parseFloat(display);
      const result = calculate(prevValue, currentNum, operator);
      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setEquation("");
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setEquation("");
    setWaitingForNewValue(false);
  };

  const handleBackspace = () => {
    if (waitingForNewValue) return;
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  const handleDot = () => {
    if (waitingForNewValue) {
      setDisplay("0.");
      setWaitingForNewValue(false);
    } else if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  // ==============================
  // 지분율 계산 로직
  // ==============================
  const currentEquity = () => {
    const total = parseFloat(totalShares.replace(/,/g, "")) || 0;
    const mine = parseFloat(myShares.replace(/,/g, "")) || 0;
    if (total === 0) return 0;
    return (mine / total) * 100;
  };

  const expectedEquity = () => {
    const total = parseFloat(totalShares.replace(/,/g, "")) || 0;
    const mine = parseFloat(myShares.replace(/,/g, "")) || 0;
    const newIssued = parseFloat(newIssuedShares.replace(/,/g, "")) || 0;
    const newBuy = parseFloat(newBuyShares.replace(/,/g, "")) || 0;
    
    const expectedTotal = total + newIssued;
    const expectedMine = mine + newBuy;

    if (expectedTotal === 0) return 0;
    return (expectedMine / expectedTotal) * 100;
  };

  const formatNumberInput = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    if (!num) return "";
    return parseInt(num, 10).toLocaleString();
  };

  const clearEquity = () => {
    setTotalShares("");
    setMyShares("");
    setNewIssuedShares("");
    setNewBuyShares("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-100 shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Inter, sans-serif" }}>계산기</h2>
              <p className="text-sm text-gray-500">일반 계산 및 주식 지분율 계산</p>
            </div>
          </div>
          
          {/* 탭 토글 */}
          <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setMode("general")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "general" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Calculator className="w-4 h-4" />
              일반 계산기
            </button>
            <button
              onClick={() => setMode("equity")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "equity" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <PieChart className="w-4 h-4" />
              지분율 계산기
            </button>
          </div>
        </div>

        <div className="p-8 bg-gray-50">
          {mode === "general" ? (
            /* ================= 일반 계산기 UI ================= */
            <div className="max-w-xs mx-auto bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-800">
              {/* 디스플레이 */}
              <div className="bg-gray-800 rounded-2xl p-4 mb-6 flex flex-col items-end justify-end h-24 overflow-hidden relative">
                <span className="text-gray-400 text-sm h-5 font-mono mb-1 truncate w-full text-right">{equation}</span>
                <span className="text-white text-4xl font-light tracking-tight truncate w-full text-right" style={{ fontFamily: "Inter, monospace" }}>
                  {display}
                </span>
              </div>
              
              {/* 키패드 */}
              <div className="grid grid-cols-4 gap-3">
                <button onClick={handleClear} className="col-span-2 bg-red-500 hover:bg-red-400 text-white rounded-2xl py-3 text-lg font-semibold transition-colors">AC</button>
                <button onClick={handleBackspace} className="bg-gray-600 hover:bg-gray-500 text-white rounded-2xl py-3 flex items-center justify-center transition-colors"><Delete className="w-5 h-5" /></button>
                <button onClick={() => handleOpClick("÷")} className="bg-blue-500 hover:bg-blue-400 text-white rounded-2xl py-3 text-xl font-medium transition-colors">÷</button>
                
                {["7", "8", "9"].map(n => <button key={n} onClick={() => handleNumClick(n)} className="bg-gray-700 hover:bg-gray-600 text-white rounded-2xl py-3 text-xl font-medium transition-colors">{n}</button>)}
                <button onClick={() => handleOpClick("×")} className="bg-blue-500 hover:bg-blue-400 text-white rounded-2xl py-3 text-xl font-medium transition-colors">×</button>
                
                {["4", "5", "6"].map(n => <button key={n} onClick={() => handleNumClick(n)} className="bg-gray-700 hover:bg-gray-600 text-white rounded-2xl py-3 text-xl font-medium transition-colors">{n}</button>)}
                <button onClick={() => handleOpClick("-")} className="bg-blue-500 hover:bg-blue-400 text-white rounded-2xl py-3 text-xl font-medium transition-colors">-</button>
                
                {["1", "2", "3"].map(n => <button key={n} onClick={() => handleNumClick(n)} className="bg-gray-700 hover:bg-gray-600 text-white rounded-2xl py-3 text-xl font-medium transition-colors">{n}</button>)}
                <button onClick={() => handleOpClick("+")} className="bg-blue-500 hover:bg-blue-400 text-white rounded-2xl py-3 text-xl font-medium transition-colors">+</button>
                
                <button onClick={() => handleNumClick("0")} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl py-3 text-xl font-medium transition-colors">0</button>
                <button onClick={handleDot} className="bg-gray-700 hover:bg-gray-600 text-white rounded-2xl py-3 text-xl font-medium transition-colors">.</button>
                <button onClick={handleEqual} className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3 text-2xl font-medium shadow-[0_0_15px_rgba(37,99,235,0.5)] transition-all">=</button>
              </div>
            </div>
          ) : (
            /* ================= 지분율 계산기 UI ================= */
            <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">📈 주식 지분율 계산</h3>
                <button onClick={clearEquity} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> 초기화
                </button>
              </div>

              <div className="space-y-6">
                {/* 현재 상태 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">현재 총 발행 주식 수</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={totalShares}
                        onChange={(e) => setTotalShares(formatNumberInput(e.target.value))}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right pr-8 font-mono text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">주</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">보유 주식 수 (내 지분)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={myShares}
                        onChange={(e) => setMyShares(formatNumberInput(e.target.value))}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right pr-8 font-mono text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">주</span>
                    </div>
                  </div>
                </div>

                {/* 추가 변동 (선택) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1.5">추가 발행 예정 주식 수 (증자 등)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newIssuedShares}
                        onChange={(e) => setNewIssuedShares(formatNumberInput(e.target.value))}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right pr-8 font-mono text-sm text-blue-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">주</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-blue-800 mb-1.5">추가 매수 예정 주식 수</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newBuyShares}
                        onChange={(e) => setNewBuyShares(formatNumberInput(e.target.value))}
                        placeholder="0"
                        className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right pr-8 font-mono text-sm text-blue-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">주</span>
                    </div>
                  </div>
                </div>

                {/* 결과 영역 */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between">
                    <div className="flex-1 bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-800 relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-gray-400 text-xs font-semibold mb-1">현재 지분율</p>
                        <p className="text-3xl font-bold text-white font-mono tracking-tight">
                          {currentEquity().toFixed(4)}<span className="text-lg text-gray-400 ml-1">%</span>
                        </p>
                      </div>
                      <PieChart className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-800/50" />
                    </div>

                    {(newIssuedShares || newBuyShares) && (
                      <div className="flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-lg border border-blue-800 relative overflow-hidden">
                        <div className="relative z-10">
                          <p className="text-blue-200 text-xs font-semibold mb-1">예상 지분율 (변동 후)</p>
                          <div className="flex items-end gap-2">
                            <p className="text-3xl font-bold text-white font-mono tracking-tight">
                              {expectedEquity().toFixed(4)}<span className="text-lg text-blue-300 ml-1">%</span>
                            </p>
                            {(() => {
                              const diff = expectedEquity() - currentEquity();
                              if (diff === 0) return null;
                              return (
                                <span className={`text-xs font-bold mb-1.5 px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(4)}%p
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <PieChart className="absolute -right-4 -bottom-4 w-24 h-24 text-blue-900/20" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
