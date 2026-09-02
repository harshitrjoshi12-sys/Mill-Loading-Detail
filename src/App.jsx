import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Truck, Plus, Trash2, Camera, Search, FileText, ArrowRight, ArrowLeft, LogOut, CheckCircle, Building, User, Phone, Check
} from 'lucide-react';

const FACTORIES = [
  { id: 'pragya', name: "Pragya Product", gradient: "from-blue-600 to-indigo-700", border: "border-blue-500", text: "text-blue-600", bgActive: "bg-blue-50" },
  { id: 'shreeram', name: "Shreeram Agro Product", gradient: "from-emerald-600 to-teal-700", border: "border-emerald-500", text: "text-emerald-600", bgActive: "bg-emerald-50" }
];
const ITEMS = ["Mogar", "Mogar Polish", "Moong Dal", "Chilka", "Churi", "Moong Grading", "Other"];
const MARKAS = ["Shreeram", "Pragya", "Sunrise", "Dolphin", "Titanic", "Rajhans", "Chetak", "Star", "Plain"];
const PACKING_SIZES = ["50 kg", "40 kg", "30 kg", "25 kg", "Other"];
const COUNTS = ["None", "500 count", "550 count", "600 count", "700 count", "750 count"];

export default function App() {
  const [role, setRole] = useState(null); // 'munim' | 'admin'
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [activeTab, setActiveTab] = useState('new');
  const [currentStep, setCurrentStep] = useState(1);
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [factory, setFactory] = useState(FACTORIES[0].name);
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
      setPinError('Galat PIN! Dubara dalein.');
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
      console.error(err);
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

  const calculateTotalBags = () => {
    return dhaange.reduce((sum, d) => sum + (Number(d.bags) || 0), 0);
  };

  const handleSubmitAll = async () => {
    if (!truckNo.trim()) return alert("Kripya Vehicle No. bharein!");
    setLoading(true);
    try {
      const processedDhaange = await Promise.all(
        dhaange.map(async (d) => {
          let photoUrl = '';
          if (d.photo) {
            photoUrl = await compressAndUpload(d.photo);
          }
          return { bags: Number(d.bags) || 0, photoUrl };
        })
      );

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

      alert("Truck Loading Safaltapoorvak Save Ho Gayi!");
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
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (record) => {
    const doc = new jsPDF();
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(record.factory_name.toUpperCase(), 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(253, 224, 71);
    doc.text(`DESPATCH LOADING SLIP & DHANG VERIFICATION`, 14, 24);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`Vehicle No: ${record.truck_number}`, 14, 38);
    doc.text(`Date: ${record.loading_date}`, 140, 38);
    doc.text(`Driver: ${record.driver_name || 'N/A'} (Mob: ${record.driver_mobile || 'N/A'})`, 14, 46);

    let currentY = 56;
    if (record.consignments && record.consignments.length > 0) {
      const c = record.consignments[0];
      doc.text(`Party: ${c.partyName || 'Direct'} | Item: ${c.item} | Marka: ${c.marka} | Packing: ${c.packing}`, 14, currentY);
      currentY += 8;

      const rows = (c.dhaange || []).map((d, idx) => [
        `Dhaang (${idx + 1})`,
        `${d.bags} Bags`,
        d.photoUrl ? 'Verified' : 'No Photo'
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Dhaang Layer', 'Quantity', 'Photo Proof']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 9 }
      });

      currentY = doc.lastAutoTable.finalY + 10;
    }

    doc.text(`Net Weight: ${record.net_weight || 'N/A'} kg`, 14, currentY);
    doc.save(`Loading_${record.truck_number}.pdf`);
  };

  // ==========================================
  // PAGE 1: MILL LOADING DESK (COLORFUL TOUCH KEYPAD IN CENTER)
  // ==========================================
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white flex flex-col items-center justify-center p-4 select-none">
        
        {/* CENTER CONTAINER CARD */}
        <div className="w-full max-w-sm bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
          
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-400 tracking-wide text-center">
            Mill Loading Desk
          </h1>
          <p className="text-indigo-200 text-xs font-semibold mt-1">Terminal Security Login</p>

          {/* PIN DISPLAY */}
          <div className="flex justify-center gap-3 my-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all ${
                  pinInput.length > idx 
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-lg shadow-amber-400/30 scale-105' 
                    : 'border-slate-700 bg-slate-800/80 text-slate-500'
                }`}
              >
                {pinInput.length > idx ? '●' : ''}
              </div>
            ))}
          </div>

          {pinError && (
            <p className="text-rose-400 text-xs font-bold text-center mb-3 animate-pulse">
              {pinError}
            </p>
          )}

          {/* 3x4 COLORFUL KEYPAD */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num.toString())}
                className="h-16 rounded-2xl bg-gradient-to-b from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 active:scale-95 text-2xl font-black text-white border border-indigo-400/40 shadow-lg shadow-indigo-900/40 flex items-center justify-center transition"
              >
                {num}
              </button>
            ))}

            {/* Clear Button (X) */}
            <button
              onClick={handleKeypadClear}
              className="h-16 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 active:scale-95 text-2xl font-black text-white border border-rose-400/40 shadow-lg flex items-center justify-center transition"
            >
              ✕
            </button>

            {/* Zero (0) */}
            <button
              onClick={() => handleKeypadPress('0')}
              className="h-16 rounded-2xl bg-gradient-to-b from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 active:scale-95 text-2xl font-black text-white border border-indigo-400/40 shadow-lg flex items-center justify-center transition"
            >
              0
            </button>

            {/* Arrow Button (->) */}
            <button
              onClick={handleKeypadSubmit}
              className="h-16 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-2xl font-black text-slate-950 shadow-lg shadow-amber-500/40 flex items-center justify-center transition"
            >
              ➔
            </button>
          </div>

          <h2 className="text-sm font-black tracking-widest text-amber-300 uppercase mt-5">
            Enter Pin
          </h2>

          <div className="w-full mt-4 pt-3 border-t border-slate-800 flex justify-around text-xs font-bold text-slate-400">
            <span>Munim: <strong className="text-amber-400">1111</strong></span>
            <span>Admin: <strong className="text-cyan-400">9999</strong></span>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // PAGES 2, 4, LAST PAGE (CENTERED, SPACIOUS & RICH COLORFUL)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center">
      
      {/* TOP BAR: FIXED & CENTERED */}
      <header className="w-full bg-white border-b-2 border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-2">
          
          {/* Exit Button */}
          <button 
            onClick={() => { setRole(null); setCurrentStep(1); }} 
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 rounded-xl text-xs font-black flex items-center gap-1 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>

          {/* Three Tab Buttons */}
          <div className="flex gap-1.5 flex-1 justify-end">
            <button
              onClick={() => { setActiveTab('new'); setCurrentStep(1); }}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'new' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              New Truck
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'pending' 
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending Slip
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition ${
                activeTab === 'history' 
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Search & PDF
            </button>
          </div>

        </div>
      </header>

      {/* MAIN CONTAINER: CENTERED WITH FULL MOBILE CARD WIDTH */}
      <main className="w-full max-w-md p-4 pb-24 flex flex-col justify-center">

        {/* ------------------ TAB: NEW TRUCK WIZARD ------------------ */}
        {activeTab === 'new' && (
          <div className="space-y-6">

            {/* ======================================================= */}
            {/* PAGE 2: FACTORY UNIT, PARTY DETAIL, TRUCK DETAIL */}
            {/* ======================================================= */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-fadeIn">
                
                {/* 1> Factory Unit */}
                <div className="bg-white p-5 rounded-3xl border-2 border-blue-200 shadow-sm space-y-3">
                  <h2 className="text-base font-black uppercase tracking-wide text-blue-700 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">1</span>
                    Factory Unit
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    {FACTORIES.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFactory(f.name)}
                        className={`p-4 rounded-2xl border-2 font-black text-sm text-center transition-all ${
                          factory === f.name 
                            ? `bg-gradient-to-br ${f.gradient} text-white ${f.border} shadow-lg scale-[1.02]` 
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2> Party Detail */}
                <div className="bg-white p-5 rounded-3xl border-2 border-teal-200 shadow-sm space-y-3">
                  <h2 className="text-base font-black uppercase tracking-wide text-teal-700 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs">2</span>
                    Party Detail
                  </h2>

                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      Name ➔
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Party / Grahak Name"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-teal-500 focus:bg-white p-3.5 rounded-2xl text-base font-bold text-slate-800 outline-none transition"
                    />
                  </div>
                </div>

                {/* 3> Truck Detail */}
                <div className="bg-white p-5 rounded-3xl border-2 border-amber-200 shadow-sm space-y-4">
                  <h2 className="text-base font-black uppercase tracking-wide text-amber-700 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs">3</span>
                    Truck Detail
                  </h2>

                  {/* Vehicle no. */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      Vehicle no. ➔ *
                    </label>
                    <input
                      type="text"
                      placeholder="RJ 21 GA 1234"
                      value={truckNo}
                      onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                      className="w-full bg-amber-50/50 border-2 border-amber-300 focus:border-amber-600 focus:bg-white p-3.5 rounded-2xl font-mono text-2xl font-black text-slate-900 tracking-wider uppercase outline-none transition"
                    />
                  </div>

                  {/* Driver Name */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      Driver name ➔
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Driver Name"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-amber-500 focus:bg-white p-3 rounded-xl text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>

                  {/* Driver Mobile */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">
                      Driver Mb. no. ➔
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={driverMobile}
                      onChange={(e) => setDriverMobile(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-amber-500 focus:bg-white p-3 rounded-xl font-mono text-sm font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {/* Big Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!truckNo.trim()) return alert("Kripya Vehicle No. bharein!");
                    setCurrentStep(2);
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-base uppercase tracking-wider shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-98 transition"
                >
                  Agla Page: Product Detail <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}


            {/* ======================================================= */}
            {/* PAGE 4: PRODUCT DETAIL */}
            {/* ======================================================= */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-fadeIn">
                
                <div className="bg-white p-5 rounded-3xl border-2 border-purple-200 shadow-sm space-y-4">
                  <h2 className="text-base font-black uppercase tracking-wide text-purple-700 border-b pb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">4</span>
                    Product Detail
                  </h2>

                  {/* Type */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1.5">Type</label>
                    <select
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-purple-500 p-3 rounded-xl font-bold text-slate-900 text-sm outline-none"
                    >
                      {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  {/* Brand / Marka */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1.5">Brand / Marka</label>
                    <select
                      value={brandMarka}
                      onChange={(e) => setBrandMarka(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-purple-500 p-3 rounded-xl font-bold text-slate-900 text-sm outline-none"
                    >
                      {MARKAS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Count */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1.5">Count</label>
                    <select
                      value={countVal}
                      onChange={(e) => setCountVal(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-purple-500 p-3 rounded-xl font-bold text-slate-900 text-sm outline-none"
                    >
                      {COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Moisture */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1.5">Moisture %</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 11.5"
                      value={moistureVal}
                      onChange={(e) => setMoistureVal(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-purple-500 p-3 rounded-xl font-mono text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>

                  {/* Package Size */}
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1.5">Package Size</label>
                    <select
                      value={packageSize}
                      onChange={(e) => setPackageSize(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-purple-500 p-3 rounded-xl font-bold text-slate-900 text-sm outline-none"
                    >
                      {PACKING_SIZES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* Back and Next */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-4 rounded-2xl bg-white border-2 border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center gap-1 active:bg-slate-100"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-black text-base uppercase tracking-wider shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 active:scale-98 transition"
                  >
                    Agla: Dhaang Detail <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            )}


            {/* ======================================================= */}
            {/* LAST PAGE: 5> DHAANG DETAIL & 6> WEIGHT SLIP */}
            {/* ======================================================= */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-fadeIn">
                
                {/* 5> Dhaang Detail */}
                <div className="bg-white p-5 rounded-3xl border-2 border-emerald-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <h2 className="text-base font-black uppercase tracking-wide text-emerald-700 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">5</span>
                      Dhaang Detail
                    </h2>
                    <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-xl">
                      Total: {calculateTotalBags()} Bags
                    </span>
                  </div>

                  {/* Rows of Dhaang */}
                  <div className="space-y-3">
                    {dhaange.map((d, dIdx) => (
                      <div key={dIdx} className="bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-200 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-slate-700 w-24">
                            Dhaang ({dIdx + 1})
                          </span>

                          {/* Bags Input */}
                          <input
                            type="number"
                            placeholder="Bags"
                            value={d.bags}
                            onChange={(e) => {
                              const updated = [...dhaange];
                              updated[dIdx].bags = e.target.value;
                              setDhaange(updated);
                            }}
                            className="w-24 bg-white border-2 border-emerald-400 focus:border-emerald-600 p-2.5 rounded-xl font-mono text-base font-black text-slate-900 text-center outline-none"
                          />

                          {/* Photo Button */}
                          <label className={`flex-1 py-2.5 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 cursor-pointer font-black text-xs transition ${
                            d.photo || d.preview 
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' 
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}>
                            <Camera className="w-4 h-4" />
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
                              onClick={() => setDhaange(dhaange.filter((_, i) => i !== dIdx))}
                              className="text-rose-500 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {d.preview && (
                          <div className="relative rounded-xl overflow-hidden h-24 border-2 border-emerald-200 mt-1">
                            <img src={d.preview} alt="Dhaang Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Dhaang Button */}
                  <button
                    type="button"
                    onClick={() => setDhaange([...dhaange, { bags: '', photo: null, preview: '' }])}
                    className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-dashed border-emerald-300 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" /> Add Dhaang ({dhaange.length + 1})
                  </button>
                </div>

                {/* 6> Weight Slip / Kanta Slip */}
                <div className="bg-white p-5 rounded-3xl border-2 border-indigo-200 shadow-sm space-y-4">
                  <h2 className="text-base font-black uppercase tracking-wide text-indigo-700 border-b pb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">6</span>
                    Weight Slip / Kanta Slip
                  </h2>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-700 block">
                      Net weight
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        placeholder="Net Wt in KG"
                        value={netWeight}
                        onChange={(e) => setNetWeight(e.target.value)}
                        className="flex-1 bg-slate-50 border-2 border-slate-300 focus:border-indigo-500 focus:bg-white p-3.5 rounded-2xl font-mono text-base font-black text-slate-900 outline-none"
                      />

                      <label className={`py-3.5 px-5 rounded-2xl border-2 flex items-center justify-center gap-2 cursor-pointer font-black text-xs transition ${
                        kantaPhoto 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                          : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}>
                        <Camera className="w-5 h-5" />
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
                      <div className="rounded-2xl overflow-hidden h-28 border-2 border-indigo-200 mt-2">
                        <img src={kantaPreview} alt="Slip Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Submit Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 py-4 rounded-2xl bg-white border-2 border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center gap-1 active:bg-slate-100"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSubmitAll}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white font-black text-base uppercase tracking-wider shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-50"
                  >
                    {loading ? 'Uploading...' : 'Save & Despatch'}
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ------------------ TAB: PENDING SLIPS ------------------ */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
              Pending Kanta Receipts
            </h2>
            {records.filter(r => r.status === 'slip_pending').length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border-2 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800">Sabhi Slips Cleared!</h3>
                <p className="text-xs text-slate-500 mt-1">Koi bhi pending kanta slip nahi hai.</p>
              </div>
            ) : (
              records.filter(r => r.status === 'slip_pending').map(r => (
                <div key={r.id} className="bg-white p-4 rounded-3xl border-2 border-amber-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-mono font-black text-lg text-slate-900">{r.truck_number}</h3>
                      <p className="text-xs text-slate-500">{r.factory_name} • {r.loading_date}</p>
                    </div>
                    <span className="text-xs font-black uppercase bg-amber-100 text-amber-800 px-2.5 py-1 rounded-xl">
                      Slip Pending
                    </span>
                  </div>

                  <div className="pt-2 border-t flex items-center gap-2">
                    <input type="file" id={`slip-${r.id}`} accept="image/*" className="text-xs flex-1" />
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
                      className="px-4 py-2 bg-emerald-600 text-white font-black text-xs rounded-xl"
                    >
                      Attach
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ------------------ TAB: SEARCH & PDF ------------------ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
              <input
                type="text"
                placeholder="Search Truck No..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-slate-300 p-3.5 pl-11 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-3">
              {records
                .filter(r => r.truck_number.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-3xl border-2 border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-mono font-black text-lg text-slate-900">{r.truck_number}</h4>
                        <p className="text-xs text-slate-500">{r.factory_name} • {r.loading_date}</p>
                      </div>
                      <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-xl ${
                        r.status === 'fully_completed' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.status === 'fully_completed' ? 'Completed' : 'Slip Pending'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl flex justify-between">
                      <span>Driver: <strong>{r.driver_name || 'N/A'}</strong></span>
                      <span>Mob: <strong>{r.driver_mobile || 'N/A'}</strong></span>
                    </div>

                    {role === 'admin' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => generatePDF(r)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-500/20"
                        >
                          <FileText className="w-4 h-4" /> Download PDF Slip
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
