import React, { useState } from 'react';
import { TextBox } from '@/components/PdfEditor';

interface MacroFormProps {
  isCorporateDoc: boolean;
  isShareholderFile: boolean;
  isCorpOwnerFile: boolean;
  currentPage: number;
  onAddBoxes: (boxes: Omit<TextBox, "id">[]) => void;
}

export default function MacroForm({ isCorporateDoc, isShareholderFile, isCorpOwnerFile, currentPage, onAddBoxes }: MacroFormProps) {
  // 주주명부 전용 상태 (배열로 7줄 관리)
  const [shareholders, setShareholders] = useState(
    Array(7).fill(null).map(() => ({ name: "", engName: "", gender: "", birth: "", nationality: "", shares: "", ownership: "" }))
  );
  const [shareholderCommon, setShareholderCommon] = useState({
    pricePerShare: "", totalShares: "", totalOwnership: "",
    today: "", company: "", address: "", repName: ""
  });

  // 지배자 확인서 전용 상태
  const [corpOwnerData, setCorpOwnerData] = useState({
    korName: "", engName: "", birth: "", nationality: "", gender: "", ownership: "", checkV: "V",
    year: "", monthDay: "", signName: ""
  });

  // 일반 법인 서류 폼 상태
  const [autoFillCompany, setAutoFillCompany] = useState("");
  const [autoFillCeo, setAutoFillCeo] = useState("");
  const [autoFillDate, setAutoFillDate] = useState("");

  const handleShareholderAutoFill = () => {
    const newBoxes: Omit<TextBox, "id">[] = [];
    const baseFields = [
      { key: 'name', x: 65, y: 205, w: 85, h: 30 },
      { key: 'engName', x: 152, y: 205, w: 64, h: 30 },
      { key: 'gender', x: 218, y: 205, w: 28, h: 30 },
      { key: 'birth', x: 248, y: 205, w: 58, h: 30 },
      { key: 'nationality', x: 308, y: 205, w: 46, h: 30 },
      { key: 'shares', x: 356, y: 205, w: 64, h: 30 },
      { key: 'ownership', x: 422, y: 205, w: 58, h: 30 },
    ];

    shareholders.forEach((sh, i) => {
      baseFields.forEach(f => {
        const val = sh[f.key as keyof typeof sh];
        if (val) {
          const actualY = i === 0 ? f.y : 205 + i * 37;
          newBoxes.push({
            text: val, x: f.x, y: actualY, width: f.w, height: f.h, fontSize: 13,
            isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
            pageIndex: currentPage,
          });
        }
      });
    });

    const commonFields = [
      { key: 'pricePerShare', x: 365, y: 140, w: 60, h: 20 },
      { key: 'totalShares', x: 356, y: 466, w: 64, h: 32 },
      { key: 'totalOwnership', x: 422, y: 466, w: 58, h: 32 },
      { key: 'today', x: 268, y: 567, w: 119, h: 20 },
      { key: 'company', x: 285, y: 597, w: 119, h: 20 },
      { key: 'address', x: 285, y: 625, w: 119, h: 20 },
      { key: 'repName', x: 285, y: 653, w: 80, h: 20 },
    ];

    commonFields.forEach(f => {
      const val = shareholderCommon[f.key as keyof typeof shareholderCommon];
      if (val) {
        newBoxes.push({
          text: val, x: f.x, y: f.y, width: f.w, height: f.h, fontSize: 13,
          isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
          pageIndex: currentPage,
        });
      }
    });

    onAddBoxes(newBoxes);
  };

  const handleCorpOwnerAutoFill = () => {
    const newBoxes: Omit<TextBox, "id">[] = [];
    const fields = [
      { key: 'korName', x: 131, y: 192, w: 60, h: 20 },
      { key: 'engName', x: 179, y: 192, w: 65, h: 20 },
      { key: 'birth', x: 247, y: 193, w: 60, h: 20 },
      { key: 'nationality', x: 293, y: 193, w: 60, h: 20 },
      { key: 'gender', x: 344, y: 194, w: 60, h: 20 },
      { key: 'ownership', x: 376, y: 195, w: 60, h: 20 },
      { key: 'checkV', x: 431, y: 190, w: 60, h: 20 },
      { key: 'year', x: 73, y: 620, w: 60, h: 20 },
      { key: 'monthDay', x: 135, y: 621, w: 60, h: 20 },
      { key: 'signName', x: 340, y: 618, w: 109, h: 20 },
    ];
    
    fields.forEach(f => {
      const val = corpOwnerData[f.key as keyof typeof corpOwnerData];
      if (val) {
        newBoxes.push({
          text: val, x: f.x, y: f.y, width: f.w, height: f.h, fontSize: 13,
          isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
          pageIndex: currentPage,
        });
      }
    });

    onAddBoxes(newBoxes);
  };

  const handleAutoFill = () => {
    const newBoxes: Omit<TextBox, "id">[] = [];
    let currentY = 150;
    
    if (autoFillCompany) {
      newBoxes.push({
        text: autoFillCompany, x: 100, y: currentY, width: 200, height: 36, fontSize: 16,
        isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR", pageIndex: currentPage,
      });
      currentY += 40;
    }
    if (autoFillCeo) {
      newBoxes.push({
        text: autoFillCeo, x: 100, y: currentY, width: 200, height: 36, fontSize: 16,
        isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR", pageIndex: currentPage,
      });
      currentY += 40;
    }
    if (autoFillDate) {
      newBoxes.push({
        text: autoFillDate, x: 100, y: currentY, width: 200, height: 36, fontSize: 16,
        isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR", pageIndex: currentPage,
      });
    }

    onAddBoxes(newBoxes);
  };

  return (
    <>
      {isShareholderFile && (
        <div className="flex flex-col gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl w-full">
          <div className="flex justify-between items-center">
            <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">주주명부 일괄 생성기 (자동 위치 지정)</div>
            <button onClick={handleShareholderAutoFill} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm">
              텍스트 일괄 생성하기
            </button>
          </div>
          
          <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {shareholders.map((sh, idx) => {
              const yBase = idx === 0 ? 205 : 242 + (idx - 1) * 40;
              return (
                <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                  <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">주주 {idx + 1} (y: {yBase})</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {[
                      { label: '성명', key: 'name' }, { label: '영문명', key: 'engName' },
                      { label: '성별', key: 'gender' }, { label: '생년월일', key: 'birth' },
                      { label: '국적', key: 'nationality' }, { label: '주식수', key: 'shares' },
                      { label: '지분율', key: 'ownership' },
                    ].map(f => (
                      <div key={f.key} className="flex flex-col">
                        <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                        <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                          value={sh[f.key as keyof typeof sh]} 
                          onChange={(e) => {
                            const newSh = [...shareholders];
                            newSh[idx] = { ...newSh[idx], [f.key]: e.target.value };
                            setShareholders(newSh);
                          }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
              <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">공통/기타 정보</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  { label: '1주 당 금액', key: 'pricePerShare' }, { label: '총주식수', key: 'totalShares' },
                  { label: '총지분율', key: 'totalOwnership' }, { label: '금일 날짜', key: 'today' },
                  { label: '상호', key: 'company' }, { label: '주소', key: 'address' },
                  { label: '이름(대표)', key: 'repName' },
                ].map(f => (
                  <div key={f.key} className="flex flex-col">
                    <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                    <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                      value={(shareholderCommon as any)[f.key]} onChange={(e) => setShareholderCommon({ ...shareholderCommon, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCorpOwnerFile && (
        <div className="flex flex-col gap-4 p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl w-full">
          <div className="flex justify-between items-center">
            <div className="text-sm font-bold text-teal-700 dark:text-teal-300">법인 소유 지배자 확인서 생성기</div>
            <button onClick={handleCorpOwnerAutoFill} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm">
              지배자 정보 생성하기
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-teal-100 dark:border-teal-800/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                { label: '한글성명', key: 'korName' }, { label: '영문성명', key: 'engName' },
                { label: '생년월일', key: 'birth' }, { label: '국적', key: 'nationality' },
                { label: '성별', key: 'gender' }, { label: '지분율', key: 'ownership' },
                { label: 'V체크', key: 'checkV' }, { label: '작성 년도', key: 'year' },
                { label: '월 일', key: 'monthDay' }, { label: '서명 성명', key: 'signName' },
              ].map(f => (
                <div key={f.key} className="flex flex-col">
                  <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                  <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-teal-500"
                    value={(corpOwnerData as any)[f.key]} 
                    onChange={(e) => setCorpOwnerData({ ...corpOwnerData, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isShareholderFile && !isCorpOwnerFile && isCorporateDoc && (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl w-full">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">회사명</label>
            <input type="text" placeholder="(주)회사이름" className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              value={autoFillCompany} onChange={e => setAutoFillCompany(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">대표자명</label>
            <input type="text" placeholder="홍길동" className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              value={autoFillCeo} onChange={e => setAutoFillCeo(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">날짜</label>
            <input type="text" placeholder="2026. 05. 30." className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              value={autoFillDate} onChange={e => setAutoFillDate(e.target.value)} />
          </div>
          <button onClick={handleAutoFill} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors whitespace-nowrap shadow-sm h-[38px]">
            텍스트 일괄 생성하기
          </button>
        </div>
      )}
    </>
  );
}
