"use client";

import React, { useState } from "react";
import PdfUploader from "@/components/PdfUploader";
import PdfEditor from "@/components/PdfEditor";

export default function ClientApp() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            PDF OCR Editor <span className="text-blue-600">MVP</span>
          </h1>
          {file && (
            <button
              onClick={() => setFile(null)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              다른 파일 선택하기
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {!file ? (
          <PdfUploader onFileSelect={setFile} />
        ) : (
          <PdfEditor file={file} />
        )}
      </main>

      <footer className="bg-white py-4 mt-auto border-t">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; 2026 PDF OCR Editor MVP. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
