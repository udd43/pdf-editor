import React, { useState } from 'react';
import { TextBox } from '@/components/PdfEditor';

interface MacroFormProps {
  isCorporateDoc: boolean;
  isShareholderFile: boolean;
  isCorpOwnerFile: boolean;
  isPersonalRepFile?: boolean;
  currentPage: number;
  onAddBoxes: (boxes: Omit<TextBox, "id">[]) => void;
}

export default function MacroForm({ isCorporateDoc, isShareholderFile, isCorpOwnerFile, isPersonalRepFile, currentPage, onAddBoxes }: MacroFormProps) {
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
    year: "", month: "", day: "", signName: ""
  });

  // 공동 대표자 서류 전용 상태
  const [personalRepData, setPersonalRepData] = useState({
    bizNum: "", companyName: "", franchiseName: "", address: "", 
    name: "", birth: "", year: "", month: "", day: "",
    jointRepBirth: "", jointRepName: "", jointRepContact: "",
    accountOwnerType: "", bankName: "", accountNum: "", accountHolder: "", relationToRep: ""
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
      { key: 'month', x: 122, y: 620, w: 25, h: 20 },
      { key: 'day', x: 153, y: 623, w: 25, h: 20 },
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

  const handlePersonalRepAutoFill = () => {
    const newBoxes: Omit<TextBox, "id">[] = [];
    
    // Page 1 fields
    const page1Fields = [
      { key: 'bizNum', x: 168, y: 107, w: 100, h: 15 },
      { key: 'companyName', x: 342, y: 107, w: 114, h: 15 },
      { key: 'franchiseName', x: 180, y: 127, w: 299, h: 10 },
      { key: 'address', x: 180, y: 146, w: 295, h: 10 },
      { key: 'name', x: 168, y: 162, w: 53, h: 13 },
      { key: 'birth', x: 343, y: 162, w: 131, h: 15 },
      { key: 'year', x: 307, y: 382, w: 33, h: 11 },
      { key: 'month', x: 362, y: 383, w: 43, h: 12 },
      { key: 'day', x: 425, y: 382, w: 42, h: 12 },
      { key: 'jointRepBirth', x: 343, y: 408, w: 123, h: 17 },
      { key: 'jointRepName', x: 144, y: 407, w: 63, h: 17 },
      { key: 'jointRepContact', x: 107, y: 428, w: 130, h: 13 },
    ];
    
    // Page 2 fields
    const page2Fields = [
      { key: 'bizNum', x: 146, y: 107, w: 105, h: 19 },
      { key: 'companyName', x: 342, y: 105, w: 139, h: 19 },
      { key: 'franchiseName', x: 164, y: 131, w: 216, h: 17 },
      { key: 'address', x: 166, y: 157, w: 213, h: 15 },
      { key: 'name', x: 146, y: 181, w: 74, h: 18 },
      { key: 'birth', x: 345, y: 182, w: 127, h: 19 },
      { key: 'accountOwnerType', x: 162, y: 208, w: 85, h: 10 },
      { key: 'bankName', x: 132, y: 283, w: 89, h: 17 },
      { key: 'accountNum', x: 315, y: 282, w: 166, h: 17 },
      { key: 'accountHolder', x: 149, y: 308, w: 111, h: 17 },
      { key: 'relationToRep', x: 362, y: 309, w: 95, h: 13 },
      { key: 'year', x: 308, y: 425, w: 31, h: 13 },
      { key: 'month', x: 368, y: 426, w: 31, h: 13 },
      { key: 'day', x: 430, y: 425, w: 31, h: 13 },
      { key: 'jointRepName', x: 137, y: 454, w: 62, h: 11 },
      { key: 'jointRepContact', x: 90, y: 476, w: 145, h: 17 },
      { key: 'jointRepBirth', x: 341, y: 452, w: 149, h: 13 },
    ];
    
    // Add page 1 fields
    page1Fields.forEach(f => {
      const val = personalRepData[f.key as keyof typeof personalRepData];
      if (val) {
        newBoxes.push({
          text: val, x: f.x, y: f.y, width: f.w, height: f.h, fontSize: 11,
          isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
          pageIndex: 1, // Page 1
        });
      }
    });

    // Add page 2 fields
    page2Fields.forEach(f => {
      const val = personalRepData[f.key as keyof typeof personalRepData];
      if (val) {
        newBoxes.push({
          text: val, x: f.x, y: f.y, width: f.w, height: f.h, fontSize: 11,
          isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
          pageIndex: 2, // Page 2
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
                { label: '월', key: 'month' }, { label: '일', key: 'day' }, { label: '서명 성명', key: 'signName' },
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

      {isPersonalRepFile && (
        <div className="flex flex-col gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl w-full">
          <div className="flex justify-between items-center">
            <div className="text-sm font-bold text-orange-700 dark:text-orange-300">개인 공동대표 서류 생성기</div>
            <button onClick={handlePersonalRepAutoFill} className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm">
              공동대표 정보 일괄 생성
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-orange-100 dark:border-orange-800/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: '사업자번호', key: 'bizNum' }, { label: '상호명', key: 'companyName' },
                { label: '가맹점명', key: 'franchiseName' }, { label: '사업장주소', key: 'address' },
                { label: '대표자성명', key: 'name' }, { label: '대표자생년월일', key: 'birth' },
                { label: '년도(끝2자리)', key: 'year' }, { label: '월', key: 'month' },
                { label: '일', key: 'day' }, { label: '공동대표 생년월일', key: 'jointRepBirth' },
                { label: '공동대표 성명', key: 'jointRepName' }, { label: '공동대표 연락처', key: 'jointRepContact' },
                { label: '계좌소유자', key: 'accountOwnerType' }, { label: '은행명(앞자리만)', key: 'bankName' },
                { label: '계좌번호', key: 'accountNum' }, { label: '예금주', key: 'accountHolder' },
                { label: '대표자와의 관계', key: 'relationToRep' }
              ].map(f => (
                <div key={f.key} className="flex flex-col">
                  <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                  <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-orange-500"
                    value={(personalRepData as any)[f.key]} 
                    onChange={(e) => setPersonalRepData({ ...personalRepData, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isShareholderFile && !isCorpOwnerFile && !isPersonalRepFile && isCorporateDoc && (
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
