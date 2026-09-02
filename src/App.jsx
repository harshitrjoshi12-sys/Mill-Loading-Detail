import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Truck, Plus, Trash2, Camera, Search, FileText, ArrowRight, ArrowLeft, LogOut, CheckCircle, Clock
} from 'lucide-react';

const FACTORIES = ["Pragya Product", "Shreeram Agro Product"];
const ITEMS = ["Mogar", "Mogar Polish", "Moong Dal", "Chilka", "Churi", "Moong Grading", "Other"];
const MARKAS = ["Shreeram", "Pragya", "Sunrise", "Dolphin", "Titanic", "Rajhans", "Chetak", "Star", "Plain"];
const PACKING_SIZES = ["50 kg", "40 kg", "30 kg", "25 kg", "Other"];
const COUNTS = ["None", "500 count", "550 count", "600 count", "700 count", "750 count"];

export default function App() {
  const [role, setRole] = useState(null); // 'munim' | 'admin'
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  // Navigation & Wizard Steps: 1 = Gaadi & Party, 2 = Product Detail, 3 = Dhaang & Weight
  const [activeTab, setActiveTab] = useState('new');
  const [currentStep, setCurrentStep] = useState(1);
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [factory, setFactory] = useState(FACTORIES[0]);
  const [partyName, setPartyName] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');

  // Product Details
  const [itemType, setItemType] = useState(ITEMS[0]);
  const [brandMarka, setBrandMarka] = useState(MARKAS[0]);
  const [countVal, setCountVal] = useState(COUNTS[0]);
  const [moistureVal, setMoistureVal] = useState('');
  const [packageSize, setPackageSize] = useState(PACKING_SIZES[0]);

  // Dhaang & Weight
  const [dhaange, setDhaange] = useState([{ bags: '', photo: null, preview: '' }]);
  const [netWeight, setNetWeight] = useState('');
  const [kantaPhoto, setKantaPhoto] = useState(null);
  const [kantaPreview, setKantaPreview] = useState('');

  useEffect(() => {
    if (role) fetchRecords();
  }, [role]);

  // Touch Keypad Handler (Page 1)
  const handleKeypadPress = (val) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + val);
    }
  };

  const handleKeypadClear = () => {
    setPinInput('');
    setPinError('');
  };

  const handleKeypadSubmit = () => {
    if (pinInput === '1111') {
      setRole('munim');
      setPinInput('');
      setPinError('');
    } else if (pinInput === '9999') {
      setRole('admin');
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Galat PIN! Kripya sahi PIN darj karein.');
      setPinInput('');
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('truck_loadings')
      .select('*')
      .order('created_at', { ascending: false });
    setRecords(data || []);
    setLoading(false);
  };

  const compressAndUpload = async (file) => {
    if (!file) return null;
    const options = { maxSizeMB: 0.4, maxWidthOrHeight: 1280, useWebWorker: true };
    try {
      const compressed = await imageCompression(file, options);
      const fileName = `mill_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from('loading-photos').upload(fileName, compressed);
      if (error) throw error;
      const { data } = supabase.storage.from('loading-photos').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  };

  const handleDhaangPhoto = (idx, file) => {
    if (!file) return;
    const updated = [...dhaange];
    updated[idx].photo = file;
    updated[idx].preview = URL.createObjectURL(file);
    setDhaange(updated);
  };

  const addDhaangRow = () => {
    setDhaange([...dhaange, { bags: '', photo: null, preview: '' }]);
  };

  const removeDhaangRow = (idx) => {
    setDhaange(dhaange.filter((_, i) => i !== idx));
  };

  const calculateTotalBags = () => {
    return dhaange.reduce((sum, d) => sum + (Number(d.bags) || 0), 0);
  };

  const handleSubmitAll = async () => {
    if (!truckNo.trim()) return alert("Truck Vehicle Number likhna zaroori hai!");
    setLoading(true);
    try {
      // Upload Dhaang Photos
      const processedDhaange = await Promise.all(
        dhaange.map(async (d) => {
          let photoUrl = '';
          if (d.photo) {
            photoUrl = await compressAndUpload(d.photo);
          }
          return { bags: Number(d.bags) || 0, photoUrl };
        })
      );

      // Upload Kanta Slip Photo
      let kantaUrl = '';
      if (kantaPhoto) {
        kantaUrl = await compressAndUpload(kantaPhoto);
      }

      const payload = {
        factory_name: factory,
        truck_number: truckNo.toUpperCase().trim(),
        driver_name: driverName.trim(),
        driver_mobile: driverMobile.trim(),
        loading_date: new Date().toISOString().split('T')[0],
        consignments: [
          {
            partyName,
            item: itemType,
            marka: brandMarka,
            packing: packageSize,
            count: countVal,
            moisture: moistureVal,
            dhaange: processedDhaange
          }
        ],
        gross_weight: null,
        tare_weight: null,
        net_weight: netWeight ? Number(netWeight) : null,
        kanta_slip_url: kantaUrl || null,
        status: kantaUrl ? 'fully_completed' : 'slip_pending',
        created_by_role: role
      };

      const { error } = await supabase.from('truck_loadings').insert([payload]);
      if (error) throw error;

      alert("Truck Loading Record Safaltapoorvak Save Ho Gaya!");
      // Reset
      setCurrentStep(1);
      setPartyName('');
      setTruckNo('');
      setDriverName('');
      setDriverMobile('');
      setMoistureVal('');
      setNetWeight('');
      setKantaPhoto(null);
      setKantaPreview('');
      setDhaange([{ bags: '', photo: null, preview: '' }]);
      fetchRecords();
      setActiveTab('history');
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (record) => {
    const doc = new jsPDF();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(record.factory_name.toUpperCase(), 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(52, 211, 153);
    doc.text(`OFFICIAL MILL DESPATCH LOADING SLIP`, 14, 25);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Vehicle No: ${record.truck_number}`, 14, 40);
    doc.text(`Date: ${record.loading_date}`, 140, 40);
    doc.text(`Driver: ${record.driver_name || 'N/A'} (Mob: ${record.driver_mobile || 'N/A'})`, 14, 48);

    let currentY = 56;
    if (record.consignments && record.consignments.length > 0) {
      const c = record.consignments[0];
      doc.text(`Party: ${c.partyName || 'Direct'} | Maal: ${c.item} | Brand/Marka: ${c.marka} | Size: ${c.packing}`, 14, currentY);
      currentY += 8;

      const rows = (c.dhaange || []).map((d, idx) => [
        `Dhaang (${idx + 1})`,
        `${d.bags} Bags`,
        d.photoUrl ? 'Photo Uploaded' : 'No Photo'
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Dhaang Layer', 'Bags Quantity', 'Verification']],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 9 }
      });

      currentY = doc.lastAutoTable.finalY + 10;
    }

    doc.text(`Net Weight: ${record.net_weight || 'N/A'} kg`, 14, currentY);
    doc.save(`Loading_${record.truck_number}.pdf`);
  };

  // ==========================================
  // PAGE 1: MILL LOADING DESK (PIN KEYPAD SCREEN)
  // ==========================================
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 select-none font-sans">
        <div className="text-center pt-6">
          <h1 className="text-3xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow">
            Mill Loading Desk
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">Authorised Terminal Login</p>
        </div>

        {/* PIN DISPLAY & KEYPAD GRID (EXACTLY AS DRAWN) */}
        <div className="max-w-xs mx-auto w-full">
          {/* PIN Boxes Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                  pinInput.length > idx 
                    ? 'border-emerald-400 bg-slate-800 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-105' 
                    : 'border-slate-700 bg-slate-800/50 text-slate-500'
                }`}
              >
                {pinInput.length > idx ? '●' : ''}
              </div>
            ))}
          </div>

          {pinError && (
            <p className="text-rose-400 text-xs text-center font-bold mb-3 animate-pulse">
              {pinError}
            </p>
          )}

          {/* 3x4 Grid Keypad */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-800/80 p-3 rounded-2xl border border-slate-700 shadow-2xl">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num.toString())}
                className="h-16 rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 active:scale-95 text-2xl font-extrabold text-white border border-slate-600 shadow-md flex items-center justify-center transition"
              >
                {num}
              </button>
            ))}
            
            {/* Clear Button (X) */}
            <button
              onClick={handleKeypadClear}
              className="h-16 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-2xl font-black text-rose-400 border border-rose-500/30 shadow-md flex items-center justify-center transition"
            >
              ✕
            </button>

            {/* Zero (0) */}
            <button
              onClick={() => handleKeypadPress('0')}
              className="h-16 rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 active:scale-95 text-2xl font-extrabold text-white border border-slate-600 shadow-md flex items-center justify-center transition"
            >
              0
            </button>

            {/* Submit Arrow (->) */}
            <button
              onClick={handleKeypadSubmit}
              className="h-16 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-2xl font-black text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition"
            >
              ➔
            </button>
          </div>

          <div className="text-center mt-4">
            <span className="text-sm font-black tracking-widest text-slate-300 uppercase">
              Enter Pin
            </span>
          </div>
        </div>

        <div className="text-center pb-3">
          <p className="text-slate-500 text-xs font-semibold">Munim: 1111 | Admin: 9999</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN APP VIEW (PAGES 2, 4, LAST PAGE)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* TOP BAR: EXIT + [NEW TRUCK] [PENDING SLIP] [SEARCH & PDF] */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 sticky top-0 z-50 shadow-md">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <button 
            onClick={() => { setRole(null); setCurrentStep(1); }} 
            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-black flex items-center gap-1 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>

          <div className="flex gap-1.5 flex-1 justify-end">
            <button
              onClick={() => { setActiveTab('new'); setCurrentStep(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'new' 
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              New Truck
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'pending' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Pending Slip
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'history' 
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Search & PDF
            </button>
          </div>
        </div>
      </header>

      {/* BODY CONTENT */}
      <main className="flex-1 max-w-xl mx-auto w-full p-4 pb-20">

        {/* ----------------- TAB: NEW TRUCK WIZARD ----------------- */}
        {activeTab === 'new' && (
          <div className="space-y-6">

            {/* ==================================================== */}
            {/* PAGE 2: FACTORY UNIT, PARTY DETAIL, TRUCK DETAIL */}
            {/* ==================================================== */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* 1> Factory Unit */}
                <div className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-lg space-y-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    1⟩ Factory Unit
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {FACTORIES.map((fName) => (
                      <button
                        key={fName}
                        type="button"
                        onClick={() => setFactory(fName)}
                        className={`p-4 rounded-2xl border-2 font-black text-sm text-center transition-all ${
                          factory === fName 
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/25 scale-[1.02]' 
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {fName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2> Party Detail */}
                <div className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-lg space-y-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-teal-400">
                    2⟩ Party Detail
                  </h2>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      Name ➔
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Party Name"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-teal-400 p-3.5 rounded-2xl text-base font-bold text-white outline-none transition"
                    />
                  </div>
                </div>

                {/* 3> Truck Detail */}
                <div className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-lg space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-cyan-400">
                    3⟩ Truck Detail
                  </h2>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      Vehicle no. ➔ *
                    </label>
                    <input
                      type="text"
                      placeholder="RJ 21 GA 1234"
                      value={truckNo}
                      onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 p-3.5 rounded-2xl font-mono text-xl font-black text-cyan-400 uppercase tracking-wider outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      Driver name ➔
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Driver Name"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 p-3 rounded-xl text-sm font-semibold text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      Driver Mb. no. ➔
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={driverMobile}
                      onChange={(e) => setDriverMobile(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 p-3 rounded-xl font-mono text-sm font-bold text-white outline-none"
                    />
                  </div>
                </div>

                {/* NEXT BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    if (!truckNo.trim()) return alert("Kripya Vehicle No. bharein!");
                    setCurrentStep(2);
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition"
                >
                  Agla Page: Product Detail <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}


            {/* ==================================================== */}
            {/* PAGE 4: PRODUCT DETAIL */}
            {/* ==================================================== */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-2">
                    4⟩ Product Detail
                  </h2>

                  {/* Type */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Type</label>
                    <select
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-3 rounded-xl font-bold text-white text-sm outline-none"
                    >
                      {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  {/* Brand / Marka */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Brand / Marka</label>
                    <select
                      value={brandMarka}
                      onChange={(e) => setBrandMarka(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-3 rounded-xl font-bold text-white text-sm outline-none"
                    >
                      {MARKAS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Count */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Count</label>
                    <select
                      value={countVal}
                      onChange={(e) => setCountVal(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-3 rounded-xl font-bold text-white text-sm outline-none"
                    >
                      {COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Moisture */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Moisture %</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 11.5"
                      value={moistureVal}
                      onChange={(e) => setMoistureVal(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-3 rounded-xl font-mono text-sm font-bold text-white outline-none"
                    />
                  </div>

                  {/* Package Size */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">Package Size</label>
                    <select
                      value={packageSize}
                      onChange={(e) => setPackageSize(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-3 rounded-xl font-bold text-white text-sm outline-none"
                    >
                      {PACKING_SIZES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* NAVIGATION BUTTONS */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition"
                  >
                    Agla: Dhaang Detail <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}


            {/* ==================================================== */}
            {/* LAST PAGE: DHAANG DETAIL & WEIGHT SLIP / KANTA SLIP */}
            {/* ==================================================== */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* 5> Dhaang Detail */}
                <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                      5⟩ Dhaang Detail
                    </h2>
                    <span className="text-xs font-black text-slate-300 bg-slate-800 px-3 py-1 rounded-xl">
                      Total: <span className="text-emerald-400">{calculateTotalBags()} Bags</span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    {dhaange.map((d, dIdx) => (
                      <div key={dIdx} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-300 w-24">
                            Dhaang ({dIdx + 1})
                          </span>

                          {/* Bags Box */}
                          <input
                            type="number"
                            placeholder="Bags"
                            value={d.bags}
                            onChange={(e) => {
                              const updated = [...dhaange];
                              updated[dIdx].bags = e.target.value;
                              setDhaange(updated);
                            }}
                            className="w-24 bg-slate-900 border-2 border-slate-700 focus:border-emerald-400 p-2.5 rounded-xl font-mono text-base font-black text-white text-center outline-none"
                          />

                          {/* Photo Button */}
                          <label className={`flex-1 py-2.5 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xs transition ${
                            d.photo || d.preview 
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm' 
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}>
                            <Camera className="w-4 h-4 text-emerald-400" />
                            <span>{d.photo ? 'Photo ✓' : 'Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handleDhaangPhoto(dIdx, e.target.files[0])}
                            />
                          </label>

                          {dhaange.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDhaangRow(dIdx)}
                              className="text-rose-400 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {d.preview && (
                          <div className="relative rounded-xl overflow-hidden h-20 border border-slate-800 mt-1">
                            <img src={d.preview} alt="Dhaang Proof" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addDhaangRow}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" /> Add Next Dhaang
                  </button>
                </div>

                {/* 6> Weight Slip / Kanta Slip */}
                <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-2">
                    6⟩ Weight Slip / Kanta Slip
                  </h2>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-300 block">
                      Net weight
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        placeholder="Net Weight in KG"
                        value={netWeight}
                        onChange={(e) => setNetWeight(e.target.value)}
                        className="flex-1 bg-slate-950 border-2 border-slate-700 focus:border-teal-400 p-3.5 rounded-2xl font-mono text-base font-black text-white outline-none"
                      />

                      <label className={`py-3.5 px-5 rounded-2xl border-2 flex items-center justify-center gap-2 cursor-pointer font-bold text-xs transition ${
                        kantaPhoto 
                          ? 'bg-teal-500/20 border-teal-400 text-teal-300' 
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}>
                        <Camera className="w-5 h-5 text-teal-400" />
                        <span>{kantaPhoto ? 'Photo ✓' : 'Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              setKantaPhoto(e.target.files[0]);
                              setKantaPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                      </label>
                    </div>

                    {kantaPreview && (
                      <div className="rounded-2xl overflow-hidden h-24 border border-slate-800 mt-2">
                        <img src={kantaPreview} alt="Kanta Slip Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* FINAL SUBMIT BUTTON */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSubmitAll}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-50"
                  >
                    {loading ? 'Uploading Data...' : 'Save & Despatch'}
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ----------------- TAB: PENDING SLIP ----------------- */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Pending Kanta Receipts
            </h2>
            {records.filter(r => r.status === 'slip_pending').length === 0 ? (
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <h3 className="font-bold text-white">Sabhi Slips Uploaded Hain!</h3>
                <p className="text-xs text-slate-400 mt-1">Koi bhi pending kanta slip nahi hai.</p>
              </div>
            ) : (
              records.filter(r => r.status === 'slip_pending').map(r => (
                <div key={r.id} className="bg-slate-900/90 p-4 rounded-3xl border border-amber-500/30 shadow-md space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-mono font-black text-lg text-emerald-400">{r.truck_number}</h3>
                      <p className="text-xs text-slate-400">{r.factory_name} • {r.loading_date}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-xl">
                      Slip Pending
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                    <input type="file" id={`slip-${r.id}`} accept="image/*" className="text-xs text-slate-400 flex-1" />
                    <button
                      onClick={async () => {
                        const fileInput = document.getElementById(`slip-${r.id}`);
                        if (!fileInput.files[0]) return alert("Pehle photo select karein!");
                        setLoading(true);
                        const url = await compressAndUpload(fileInput.files[0]);
                        await supabase.from('truck_loadings').update({ kanta_slip_url: url, status: 'fully_completed' }).eq('id', r.id);
                        fetchRecords();
                        alert("Kanta Slip Upload Ho Gayi!");
                      }}
                      className="px-4 py-2 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl"
                    >
                      Attach
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ----------------- TAB: SEARCH & PDF ----------------- */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
              <input
                type="text"
                placeholder="Search Truck No..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 p-3.5 pl-11 rounded-2xl text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-3">
              {records
                .filter(r => r.truck_number.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(r => (
                  <div key={r.id} className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-md space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-mono font-black text-lg text-white">{r.truck_number}</h4>
                        <p className="text-xs text-slate-400">{r.factory_name} • {r.loading_date}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${
                        r.status === 'fully_completed' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {r.status === 'fully_completed' ? 'Completed' : 'Slip Pending'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-2xl flex justify-between">
                      <span>Driver: <strong className="text-white">{r.driver_name || 'N/A'}</strong></span>
                      <span>Mob: <strong className="text-white">{r.driver_mobile || 'N/A'}</strong></span>
                    </div>

                    {role === 'admin' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => generatePDF(r)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                        >
                          <FileText className="w-4 h-4" /> Download Official PDF Slip
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
