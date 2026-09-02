import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Truck, Plus, Trash2, Camera, Search, FileText, Scale, 
  CheckCircle2, Clock, ChevronRight, ArrowLeft, LogOut,
  Layers, Package, ShieldCheck, Sparkles, Building2, Phone, User
} from 'lucide-react';

const FACTORIES = [
  { id: "pragya", name: "Pragya Products", badge: "UNIT 01", desc: "Main Processing Plant", theme: "from-blue-600 to-indigo-800", border: "border-blue-500", glow: "shadow-blue-500/20" },
  { id: "shreeram", name: "Shreeram Agro Product", badge: "UNIT 02", desc: "Agro Milling Facility", theme: "from-emerald-600 to-teal-800", border: "border-emerald-500", glow: "shadow-emerald-500/20" }
];

const ITEMS = ["Mogar", "Mogar Polish", "Moong Dal", "Chilka", "Churi", "Moong Grading", "Other Item"];
const MARKAS = ["Shreeram", "Pragya", "Sunrise", "Dolphin", "Titanic", "Rajhans", "Chetak", "Star", "Plain Marka"];
const PACKING_SIZES = ["50 KG", "40 KG", "30 KG", "25 KG", "Custom Size"];
const COUNTS = ["None / Standard", "500 Count", "550 Count", "600 Count", "700 Count", "750 Count"];

export default function App() {
  const [role, setRole] = useState(null); // 'munim' | 'admin'
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  
  // Navigation: 'new' | 'pending' | 'history'
  const [activeTab, setActiveTab] = useState('new');
  
  // Multi-step Wizard for New Entry: 1 (Vehicle), 2 (Maal/Item), 3 (Dhaang Photos), 4 (Kanta & Review)
  const [step, setStep] = useState(1);
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [factory, setFactory] = useState(FACTORIES[0].name);
  const [truckNo, setTruckNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');

  const [consignments, setConsignments] = useState([createNewConsignment()]);
  const [activePartIndex, setActivePartIndex] = useState(0);

  // Dharam Kanta
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [kantaSlip, setKantaSlip] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);

  function createNewConsignment() {
    return {
      partyName: '',
      item: ITEMS[0],
      marka: MARKAS[0],
      packing: PACKING_SIZES[0],
      count: COUNTS[0],
      moisture: '',
      dhaange: [{ bags: '', photo: null, previewUrl: '' }]
    };
  }

  useEffect(() => {
    if (role) fetchRecords();
  }, [role]);

  // Auto calculate net weight
  useEffect(() => {
    if (grossWeight && tareWeight) {
      const net = Number(grossWeight) - Number(tareWeight);
      setNetWeight(net > 0 ? net : '');
    }
  }, [grossWeight, tareWeight]);

  const handleKeypadPress = (val) => {
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === '1111') {
          setRole('munim');
          setPin('');
          setPinError(false);
        } else if (nextPin === '9999') {
          setRole('admin');
          setPin('');
          setPinError(false);
        } else {
          setPinError(true);
          setTimeout(() => {
            setPin('');
            setPinError(false);
          }, 800);
        }
      }
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
    const options = { maxSizeMB: 0.35, maxWidthOrHeight: 1200, useWebWorker: true };
    try {
      const compressed = await imageCompression(file, options);
      const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(6)}.jpg`;
      const { error } = await supabase.storage.from('loading-photos').upload(fileName, compressed);
      if (error) throw error;
      const { data } = supabase.storage.from('loading-photos').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const calculateTotalBags = () => {
    return consignments.reduce((sum, c) => 
      sum + c.dhaange.reduce((dSum, d) => dSum + (Number(d.bags) || 0), 0), 0
    );
  };

  const handlePhotoSelect = (cIdx, dIdx, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const updated = [...consignments];
    updated[cIdx].dhaange[dIdx].photo = file;
    updated[cIdx].dhaange[dIdx].previewUrl = previewUrl;
    setConsignments(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const processedConsignments = await Promise.all(
        consignments.map(async (c) => {
          const updatedDhaange = await Promise.all(
            c.dhaange.map(async (d) => {
              let photoUrl = '';
              if (d.photo) {
                photoUrl = await compressAndUpload(d.photo);
              }
              return { bags: Number(d.bags) || 0, photoUrl };
            })
          );
          return { ...c, dhaange: updatedDhaange };
        })
      );

      let slipUrl = null;
      if (kantaSlip) {
        slipUrl = await compressAndUpload(kantaSlip);
      }

      const payload = {
        factory_name: factory,
        truck_number: truckNo.toUpperCase().trim(),
        driver_name: driverName.trim(),
        driver_mobile: driverMobile.trim(),
        loading_date: new Date().toISOString().split('T')[0],
        consignments: processedConsignments,
        gross_weight: grossWeight ? Number(grossWeight) : null,
        tare_weight: tareWeight ? Number(tareWeight) : null,
        net_weight: netWeight ? Number(netWeight) : null,
        kanta_slip_url: slipUrl,
        status: slipUrl ? 'fully_completed' : 'slip_pending',
        created_by_role: role
      };

      const { error } = await supabase.from('truck_loadings').insert([payload]);
      if (error) throw error;

      alert("Truck Despatch Record Safalta Se Save Ho Gaya!");
      // Reset Form & Steps
      setStep(1);
      setTruckNo('');
      setDriverName('');
      setDriverMobile('');
      setConsignments([createNewConsignment()]);
      setActivePartIndex(0);
      setGrossWeight('');
      setTareWeight('');
      setNetWeight('');
      setKantaSlip(null);
      setSlipPreview(null);
      fetchRecords();
      setActiveTab('history');
    } catch (err) {
      alert("Saving Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (record) => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(record.factory_name.toUpperCase(), 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(52, 211, 153);
    doc.text(`DESPATCH LOADING SLIP & DHANG PROOF REPORT`, 14, 25);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text(`Truck No: ${record.truck_number}`, 14, 42);
    doc.text(`Date: ${record.loading_date}`, 140, 42);
    doc.text(`Driver: ${record.driver_name || 'N/A'} (Mob: ${record.driver_mobile || 'N/A'})`, 14, 50);

    let currentY = 60;
    record.consignments.forEach((c, i) => {
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Part ${i + 1}: ${c.partyName || 'Direct Party'} | ${c.item} | Marka: ${c.marka} | Packing: ${c.packing}`, 14, currentY);
      currentY += 6;

      const rows = c.dhaange.map((d, dIdx) => [
        `Dhaang ${dIdx + 1}`,
        `${d.bags} Bags`,
        d.photoUrl ? 'Verified' : 'No Photo'
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Layer No.', 'Bags Count', 'Visual Proof Status']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 8 }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    });

    doc.text(`Weight: Gross: ${record.gross_weight || 'N/A'} kg | Tare: ${record.tare_weight || 'N/A'} kg | Net: ${record.net_weight || 'N/A'} kg`, 14, currentY);
    doc.save(`Loading_${record.truck_number}.pdf`);
  };

  // --- LUXURY KEYPAD LOGIN SCREEN ---
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 select-none relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center pt-8 z-10">
          <div className="inline-flex p-4 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-2xl shadow-emerald-500/30 mb-4 ring-8 ring-emerald-500/10">
            <Truck className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Mill Loading Desk</h1>
          <p className="text-slate-400 text-xs font-medium tracking-wide mt-1">Select Mode & Enter 4-Digit Security PIN</p>
        </div>

        <div className="max-w-xs mx-auto w-full z-10">
          <div className="flex justify-center gap-5 my-8">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  pin.length > idx 
                    ? pinError ? 'bg-rose-500 scale-125 shadow-lg shadow-rose-500/50' : 'bg-emerald-400 scale-125 shadow-lg shadow-emerald-400/50' 
                    : 'bg-slate-800 ring-2 ring-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num.toString())}
                className="h-16 rounded-2xl bg-slate-900/90 active:bg-emerald-500 active:text-slate-950 text-2xl font-black border border-slate-800 shadow-xl flex items-center justify-center transition"
              >
                {num}
              </button>
            ))}
            <div className="flex items-center justify-center text-[10px] font-black tracking-widest text-slate-600">PIN LOCK</div>
            <button
              onClick={() => handleKeypadPress('0')}
              className="h-16 rounded-2xl bg-slate-900/90 active:bg-emerald-500 active:text-slate-950 text-2xl font-black border border-slate-800 shadow-xl flex items-center justify-center transition"
            >
              0
            </button>
            <button
              onClick={() => { setPin(pin.slice(0, -1)); setPinError(false); }}
              className="h-16 rounded-2xl bg-rose-500/10 active:bg-rose-500 active:text-white text-xs font-black text-rose-400 border border-rose-500/20 shadow-xl flex items-center justify-center transition"
            >
              DEL
            </button>
          </div>
        </div>

        <div className="text-center pb-4 text-xs font-semibold text-slate-500 z-10 flex justify-center gap-6">
          <span>Munim PIN: <strong className="text-emerald-400">1111</strong></span>
          <span>Admin PIN: <strong className="text-blue-400">9999</strong></span>
        </div>
      </div>
    );
  }

  // --- LOGGED IN WORKSPACE ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-md">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wider uppercase text-white leading-none">MILL DESPATCH PRO</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${role === 'munim' ? 'bg-emerald-400' : 'bg-blue-400'} animate-pulse`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {role === 'munim' ? 'Munim Terminal' : 'Admin Control'}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setRole(null)} 
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </header>

      {/* Main Mode Navigation */}
      <nav className="bg-slate-900 px-4 pt-2 border-b border-slate-800 flex gap-4">
        <button 
          onClick={() => { setActiveTab('new'); setStep(1); }} 
          className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'new' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-500'
          }`}
        >
          <Plus className="w-4 h-4" /> Naya Truck
        </button>
        <button 
          onClick={() => setActiveTab('pending')} 
          className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'pending' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-500'
          }`}
        >
          <Clock className="w-4 h-4" /> Pending Slips
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'history' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-500'
          }`}
        >
          <Search className="w-4 h-4" /> Search & PDF
        </button>
      </nav>

      {/* Page Content Body */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 pb-28">

        {/* ================= TAB 1: NEW ENTRY (MULTI-SCREEN WIZARD) ================= */}
        {activeTab === 'new' && (
          <div className="space-y-6">

            {/* STEP PROGRESS BAR */}
            <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
              {[
                { s: 1, label: "Gaadi Info" },
                { s: 2, label: "Maal Type" },
                { s: 3, label: "Dhaang Photo" },
                { s: 4, label: "Kanta Slip" }
              ].map((item, idx) => (
                <div key={item.s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                    step === item.s 
                      ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-400/30 scale-110' 
                      : step > item.s 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-500'
                  }`}>
                    {step > item.s ? '✓' : item.s}
                  </div>
                  <span className={`text-[11px] font-bold hidden sm:inline ${step === item.s ? 'text-white' : 'text-slate-500'}`}>
                    {item.label}
                  </span>
                  {idx < 3 && <span className="text-slate-700 text-xs hidden sm:inline">›</span>}
                </div>
              ))}
            </div>

            {/* --- SCREEN 1: VEHICLE & FACTORY SELECTION --- */}
            {step === 1 && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <label className="text-xs font-black tracking-wider uppercase text-slate-400 block mb-2.5">
                    1. Factory Unit Chunein
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {FACTORIES.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => setFactory(f.name)}
                        className={`p-4 rounded-3xl cursor-pointer border-2 transition-all relative overflow-hidden flex items-center justify-between ${
                          factory === f.name 
                            ? `bg-gradient-to-r ${f.theme} ${f.border} shadow-xl ${f.glow} scale-[1.01]` 
                            : 'bg-slate-900/60 border-slate-800 opacity-60'
                        }`}
                      >
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">{f.badge}</span>
                          <h3 className="font-extrabold text-lg text-white mt-0.5">{f.name}</h3>
                          <p className="text-xs text-slate-200/80">{f.desc}</p>
                        </div>
                        {factory === f.name && (
                          <div className="w-8 h-8 rounded-full bg-white text-slate-950 flex items-center justify-center font-black shadow-md">
                            ✓
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
                  <div>
                    <label className="text-xs font-black tracking-wider uppercase text-slate-400 block mb-1.5">
                      Truck / Gaadi Number *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="RJ 21 GA 1234"
                        value={truckNo}
                        onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-4 rounded-2xl font-mono font-black text-2xl tracking-wider text-emerald-400 uppercase placeholder-slate-600 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver Ka Naam</label>
                      <input
                        type="text"
                        placeholder="Driver Name"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-sm font-semibold text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver Mobile Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Mobile No."
                        value={driverMobile}
                        onChange={(e) => setDriverMobile(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-sm font-mono text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!truckNo.trim()) return alert("Kripya Truck Number bharein!");
                    setStep(2);
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition"
                >
                  Agla: Maal & Party Detail <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- SCREEN 2: MAAL, PARTY & CONSIGNMENT SETUP --- */}
            {step === 2 && (
              <div className="space-y-5 animate-fadeIn">
                {/* Multi-part tabs if mixed maal */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {consignments.map((_, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => setActivePartIndex(pIdx)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                          activePartIndex === pIdx 
                            ? 'bg-emerald-400 text-slate-950' 
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        Part {pIdx + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConsignments([...consignments, createNewConsignment()]);
                      setActivePartIndex(consignments.length);
                    }}
                    className="text-xs bg-slate-800 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Part
                  </button>
                </div>

                {/* Active Consignment Card */}
                {consignments[activePartIndex] && (
                  <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                      <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                        Part {activePartIndex + 1} Specification
                      </span>
                      {consignments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = consignments.filter((_, idx) => idx !== activePartIndex);
                            setConsignments(filtered);
                            setActivePartIndex(0);
                          }}
                          className="text-rose-400 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Part
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1">Grahak / Party Name</label>
                      <input
                        type="text"
                        placeholder="Party Ka Naam (Optional)"
                        value={consignments[activePartIndex].partyName}
                        onChange={(e) => {
                          const updated = [...consignments];
                          updated[activePartIndex].partyName = e.target.value;
                          setConsignments(updated);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 p-3 rounded-2xl text-base font-bold text-white outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1.5">Maal Type (Product)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ITEMS.map((item) => (
                          <div
                            key={item}
                            onClick={() => {
                              const updated = [...consignments];
                              updated[activePartIndex].item = item;
                              setConsignments(updated);
                            }}
                            className={`p-3 rounded-xl border text-center cursor-pointer font-bold text-xs transition ${
                              consignments[activePartIndex].item === item 
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md scale-[1.02]' 
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1.5">Bag Marka (Brand)</label>
                      <div className="grid grid-cols-3 gap-2">
                        {MARKAS.map((m) => (
                          <div
                            key={m}
                            onClick={() => {
                              const updated = [...consignments];
                              updated[activePartIndex].marka = m;
                              setConsignments(updated);
                            }}
                            className={`p-2.5 rounded-xl border text-center cursor-pointer font-bold text-xs transition ${
                              consignments[activePartIndex].marka === m 
                                ? 'bg-blue-500 text-white border-blue-400 shadow-md scale-[1.02]' 
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}
                          >
                            {m}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Packing Size</label>
                        <select
                          value={consignments[activePartIndex].packing}
                          onChange={(e) => {
                            const updated = [...consignments];
                            updated[activePartIndex].packing = e.target.value;
                            setConsignments(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-xs font-bold text-white outline-none"
                        >
                          {PACKING_SIZES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">Moisture % (Nami)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 11.2"
                          value={consignments[activePartIndex].moisture}
                          onChange={(e) => {
                            const updated = [...consignments];
                            updated[activePartIndex].moisture = e.target.value;
                            setConsignments(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 p-2 rounded-xl text-xs font-mono font-bold text-white outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-sm flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition"
                  >
                    Agla: Dhaang Photo Desk <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* --- SCREEN 3: DHAANG PHOTO STUDIO & LIVE BAG CALCULATOR --- */}
            {step === 3 && (
              <div className="space-y-5 animate-fadeIn">
                {/* Total Live Bag Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-3xl border border-indigo-500/30 flex justify-between items-center shadow-xl">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">Total Truck Loading</span>
                    <span className="text-3xl font-black text-white font-mono tracking-tight">{calculateTotalBags()} <span className="text-emerald-400 text-lg">BAGS</span></span>
                  </div>
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/30">
                    <Layers className="w-7 h-7" />
                  </div>
                </div>

                {/* Layer Cards for current part */}
                <div className="space-y-3">
                  {consignments[activePartIndex]?.dhaange.map((d, dIdx) => (
                    <div key={dIdx} className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 space-y-3 shadow-md">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-sm text-slate-200">
                          Layer {dIdx + 1} (Dhaang)
                        </span>
                        {consignments[activePartIndex].dhaange.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...consignments];
                              updated[activePartIndex].dhaange = updated[activePartIndex].dhaange.filter((_, i) => i !== dIdx);
                              setConsignments(updated);
                            }}
                            className="text-rose-400 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">Bags Ki Sankhya</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={d.bags}
                            onChange={(e) => {
                              const updated = [...consignments];
                              updated[activePartIndex].dhaange[dIdx].bags = e.target.value;
                              setConsignments(updated);
                            }}
                            className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 p-3 rounded-2xl font-mono font-black text-xl text-white outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-400 block mb-1">Dhaang Proof</label>
                          <label className={`w-full h-14 rounded-2xl border-2 flex items-center justify-center gap-2 cursor-pointer transition font-bold text-xs ${
                            d.photo || d.previewUrl 
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' 
                              : 'bg-slate-950 border-slate-700 text-slate-300 active:bg-slate-800'
                          }`}>
                            <Camera className="w-5 h-5 text-emerald-400" />
                            <span>{d.photo ? 'Photo Ready ✓' : 'Take Camera'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handlePhotoSelect(activePartIndex, dIdx, e.target.files[0])}
                            />
                          </label>
                        </div>
                      </div>

                      {d.previewUrl && (
                        <div className="relative rounded-2xl overflow-hidden h-28 border border-slate-700">
                          <img src={d.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400">
                            Layer {dIdx + 1} Captured
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const updated = [...consignments];
                    updated[activePartIndex].dhaange.push({ bags: '', photo: null, previewUrl: '' });
                    setConsignments(updated);
                  }}
                  className="w-full py-3.5 bg-slate-900 border-2 border-dashed border-emerald-500/30 text-emerald-400 font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Nayi Dhaang Layer Jodein
                </button>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-sm flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition"
                  >
                    Agla: Weight & Confirm <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* --- SCREEN 4: WEIGHT BRIDGE & FINAL DISPATCH CONFIRMATION --- */}
            {step === 4 && (
              <div className="space-y-5 animate-fadeIn">
                {/* Summary Card */}
                <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                    Loading Verification Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Factory:</span>
                      <strong className="text-white text-sm">{factory}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Truck No:</span>
                      <strong className="text-emerald-400 text-sm font-mono">{truckNo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Driver:</span>
                      <strong className="text-white">{driverName || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Load:</span>
                      <strong className="text-emerald-400 text-sm font-black">{calculateTotalBags()} Bags</strong>
                    </div>
                  </div>
                </div>

                {/* Dharam Kanta Inputs */}
                <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Scale className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-extrabold text-sm text-white">Dharam Kanta Weight (Optional)</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Gross (kg)</label>
                      <input
                        type="number"
                        placeholder="Gross"
                        value={grossWeight}
                        onChange={e => setGrossWeight(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Tare (kg)</label>
                      <input
                        type="number"
                        placeholder="Tare"
                        value={tareWeight}
                        onChange={e => setTareWeight(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl font-mono text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Net Weight</label>
                      <input
                        type="number"
                        placeholder="Net"
                        readOnly
                        value={netWeight}
                        className="w-full bg-slate-950 border border-emerald-500/50 p-2.5 rounded-xl font-mono text-xs font-bold text-emerald-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1.5">Kanta Receipt / Parchi Photo</label>
                    <label className="w-full py-3.5 px-4 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-between cursor-pointer active:bg-slate-800">
                      <span className="text-xs font-bold text-slate-300">
                        {kantaSlip ? 'Receipt Photo Selected ✓' : 'Attach Kanta Parchi'}
                      </span>
                      <Camera className="w-5 h-5 text-emerald-400" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files[0]) {
                            setKantaSlip(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-sm flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Peeche
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSubmit}
                    className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl shadow-emerald-500/30 active:scale-98 transition disabled:opacity-50"
                  >
                    {loading ? 'Uploading...' : 'Save & Despatch'}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ================= TAB 2: PENDING SLIPS ================= */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Kanta Slip Awaiting ({records.filter(r => r.status === 'slip_pending').length})
            </h2>

            {records.filter(r => r.status === 'slip_pending').length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-3xl text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <h3 className="font-extrabold text-white text-base">Sabhi Slips Cleared!</h3>
                <p className="text-xs text-slate-400 mt-1">Kisi bhi gaadi ki kanta slip pending nahi hai.</p>
              </div>
            ) : (
              records.filter(r => r.status === 'slip_pending').map(r => (
                <div key={r.id} className="bg-slate-900/90 p-4 rounded-3xl border border-amber-500/30 shadow-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-mono font-black text-lg text-emerald-400">{r.truck_number}</h3>
                      <p className="text-xs text-slate-400">{r.factory_name} • {r.loading_date}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                      Slip Pending
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                    <input type="file" id={`slip-${r.id}`} accept="image/*" className="text-xs text-slate-400 flex-1" />
                    <button
                      onClick={async () => {
                        const fileInput = document.getElementById(`slip-${r.id}`);
                        if (!fileInput.files[0]) return alert("Pehle parchi select karein!");
                        setLoading(true);
                        const url = await compressAndUpload(fileInput.files[0]);
                        await supabase.from('truck_loadings').update({ kanta_slip_url: url, status: 'fully_completed' }).eq('id', r.id);
                        fetchRecords();
                        alert("Kanta Slip Attach Ho Gayi!");
                      }}
                      className="px-4 py-2 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-md"
                    >
                      Attach
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 3: SEARCH & EXPORT PDF ================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
              <input
                type="text"
                placeholder="Search Truck No..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 p-3.5 pl-11 rounded-2xl text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-blue-400"
              />
            </div>

            <div className="space-y-3">
              {records
                .filter(r => r.truck_number.toLowerCase().includes(search.toLowerCase()))
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
                        {r.status === 'fully_completed' ? 'Cleared' : 'Slip Pending'}
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
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
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
