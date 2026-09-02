import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Truck, Plus, Trash2, Camera, Search, FileText, Building2, Scale, 
  CheckCircle, Clock, ChevronRight, ArrowLeft, ShieldCheck, LogOut,
  Layers, Package, AlertCircle
} from 'lucide-react';

const FACTORIES = [
  { name: "Pragya Products", tag: "Unit 1", color: "from-blue-600 to-indigo-700" },
  { name: "Shreeram Agro Product", tag: "Unit 2", color: "from-emerald-600 to-teal-800" }
];
const ITEMS = ["Mogar", "Mogar Polish", "Moong Dal", "Chilka", "Churi", "Moong Grading", "Other"];
const MARKAS = ["Shreeram", "Pragya", "Sunrise", "Dolphin", "Titanic", "Rajhans", "Chetak", "Star", "Plain"];
const PACKING_SIZES = ["50 kg", "40 kg", "30 kg", "25 kg", "Custom"];
const COUNTS = ["None / Normal", "500 Count", "550 Count", "600 Count", "700 Count", "750 Count"];

export default function App() {
  const [role, setRole] = useState(null); // 'munim' | 'admin'
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [factory, setFactory] = useState(FACTORIES[0].name);
  const [truckNo, setTruckNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [consignments, setConsignments] = useState([createNewConsignment()]);
  
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

  const handleKeypadPress = (val) => {
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setPinError(false);
  };

  const verifyPin = (inputPin) => {
    if (inputPin === '1111') {
      setRole('munim');
      setPin('');
      setPinError(false);
    } else if (inputPin === '9999') {
      setRole('admin');
      setPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => {
        setPin('');
        setPinError(false);
      }, 1000);
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
      const fileName = `loading_${Date.now()}_${Math.random().toString(36).substring(6)}.jpg`;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!truckNo.trim()) return alert("Truck Number bharna zaroori hai!");
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

      alert("Truck Loading Safaltapoorvak Save Ho Gayi!");
      setTruckNo('');
      setDriverName('');
      setDriverMobile('');
      setConsignments([createNewConsignment()]);
      setGrossWeight('');
      setTareWeight('');
      setNetWeight('');
      setKantaSlip(null);
      setSlipPreview(null);
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
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(record.factory_name.toUpperCase(), 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`DESPATCH LOADING SLIP & PROOF REPORT`, 14, 25);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.text(`Truck No: ${record.truck_number}`, 14, 42);
    doc.text(`Date: ${record.loading_date}`, 140, 42);
    doc.text(`Driver: ${record.driver_name || 'N/A'} | Mob: ${record.driver_mobile || 'N/A'}`, 14, 50);

    let currentY = 60;
    record.consignments.forEach((c, i) => {
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Part ${i + 1}: ${c.partyName || 'Direct'} — ${c.item} (${c.marka} / ${c.packing})`, 14, currentY);
      currentY += 6;

      const rows = c.dhaange.map((d, dIdx) => [
        `Dhaang ${dIdx + 1}`,
        `${d.bags} Bags`,
        d.photoUrl ? 'Photo Proof Verified' : 'No Photo'
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Dhaang Layer', 'Quantity (Bags)', 'Visual Verification']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 9 }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    });

    doc.text(`Kanta Summary: Gross: ${record.gross_weight || 'N/A'} kg | Tare: ${record.tare_weight || 'N/A'} kg | Net: ${record.net_weight || 'N/A'} kg`, 14, currentY);
    doc.save(`Loading_${record.truck_number}.pdf`);
  };

  // Modern Keypad Lock Screen
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-between p-6 select-none">
        <div className="text-center pt-8">
          <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-xl">
            <Truck className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">Mill Loading Desk</h1>
          <p className="text-slate-400 text-xs mt-1">Pragya Products • Shreeram Agro</p>
        </div>

        {/* PIN Indicators */}
        <div className="max-w-xs mx-auto w-full">
          <div className="flex justify-center gap-4 my-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  pin.length > idx 
                    ? pinError ? 'bg-rose-500 scale-125' : 'bg-emerald-400 scale-125' 
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-rose-400 text-xs text-center font-bold animate-bounce">
              GALAT PIN! DOBARA TRY KAREIN
            </p>
          )}

          {/* Touch Pad */}
          <div className="grid grid-cols-3 gap-3 text-white">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num.toString())}
                className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-2xl font-bold border border-slate-700/50 shadow-lg flex items-center justify-center transition"
              >
                {num}
              </button>
            ))}
            <div className="flex items-center justify-center text-xs text-slate-500 font-bold">UNIT</div>
            <button
              onClick={() => handleKeypadPress('0')}
              className="h-16 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 text-2xl font-bold border border-slate-700/50 shadow-lg flex items-center justify-center transition"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-16 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-sm font-bold text-rose-400 border border-rose-500/20 shadow-lg flex items-center justify-center transition"
            >
              CLEAR
            </button>
          </div>
        </div>

        <div className="text-center pb-4">
          <p className="text-slate-500 text-[11px]">Munim: 1111 • Admin: 9999</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="bg-slate-950 text-white p-4 sticky top-0 z-50 shadow-lg flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500 rounded-xl text-slate-950 font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide leading-none">MILL DESPATCH TERMINAL</h1>
            <span className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {role === 'munim' ? 'Munim Entry Mode' : 'Admin Control Mode'}
            </span>
          </div>
        </div>
        <button 
          onClick={() => setRole(null)} 
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Navigation */}
      <div className="bg-white px-4 pt-2 border-b flex gap-6">
        <button 
          onClick={() => setActiveTab('new')} 
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'new' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400'
          }`}
        >
          <Plus className="w-4 h-4" /> Naya Truck Entry
        </button>
        <button 
          onClick={() => setActiveTab('pending')} 
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'pending' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400'
          }`}
        >
          <Clock className="w-4 h-4" /> Pending Slips
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
          }`}
        >
          <Search className="w-4 h-4" /> Records
        </button>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-4 pb-28">
        {activeTab === 'new' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Factory Selector Banner */}
            <div className="grid grid-cols-2 gap-3">
              {FACTORIES.map(f => (
                <div
                  key={f.name}
                  onClick={() => setFactory(f.name)}
                  className={`p-3.5 rounded-2xl cursor-pointer border-2 transition relative overflow-hidden shadow-sm ${
                    factory === f.name ? 'border-emerald-500 bg-white ring-4 ring-emerald-500/10' : 'border-slate-200 bg-white/60 opacity-60'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase text-slate-400 block">{f.tag}</span>
                  <span className="font-extrabold text-sm text-slate-900 block mt-0.5">{f.name}</span>
                  {factory === f.name && (
                    <div className="absolute top-2 right-2 text-emerald-500">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Truck & Driver Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Vehicle Identification</h3>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Truck Number *</label>
                <input
                  type="text"
                  placeholder="RJ 21 GA 1234"
                  value={truckNo}
                  onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                  required
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-lg text-slate-900 uppercase focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Driver Name</label>
                  <input
                    type="text"
                    placeholder="Driver Name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Driver Mobile</label>
                  <input
                    type="tel"
                    placeholder="10 digit mobile"
                    value={driverMobile}
                    onChange={(e) => setDriverMobile(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Consignments Cards */}
            {consignments.map((c, cIdx) => (
              <div key={cIdx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center">
                      {cIdx + 1}
                    </span>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">Consignment / Item Details</h3>
                  </div>
                  {consignments.length > 1 && (
                    <button type="button" onClick={() => setConsignments(consignments.filter((_, i) => i !== cIdx))} className="text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Party / Grahak Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Trading Co."
                      value={c.partyName}
                      onChange={(e) => {
                        const updated = [...consignments];
                        updated[cIdx].partyName = e.target.value;
                        setConsignments(updated);
                      }}
                      className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Maal Type</label>
                      <select
                        value={c.item}
                        onChange={(e) => {
                          const updated = [...consignments];
                          updated[cIdx].item = e.target.value;
                          setConsignments(updated);
                        }}
                        className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold"
                      >
                        {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Bag Marka</label>
                      <select
                        value={c.marka}
                        onChange={(e) => {
                          const updated = [...consignments];
                          updated[cIdx].marka = e.target.value;
                          setConsignments(updated);
                        }}
                        className="w-full mt-1 p-2.5 bg-slate-50 border rounded-xl text-sm font-semibold"
                      >
                        {MARKAS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Packing</label>
                      <select
                        value={c.packing}
                        onChange={(e) => {
                          const updated = [...consignments];
                          updated[cIdx].packing = e.target.value;
                          setConsignments(updated);
                        }}
                        className="w-full mt-1 p-2 bg-slate-50 border rounded-xl text-xs font-semibold"
                      >
                        {PACKING_SIZES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Count</label>
                      <select
                        value={c.count}
                        onChange={(e) => {
                          const updated = [...consignments];
                          updated[cIdx].count = e.target.value;
                          setConsignments(updated);
                        }}
                        className="w-full mt-1 p-2 bg-slate-50 border rounded-xl text-xs font-semibold"
                      >
                        {COUNTS.map(cnt => <option key={cnt} value={cnt}>{cnt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700">Moisture %</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="11.5"
                        value={c.moisture}
                        onChange={(e) => {
                          const updated = [...consignments];
                          updated[cIdx].moisture = e.target.value;
                          setConsignments(updated);
                        }}
                        className="w-full mt-1 p-2 bg-slate-50 border rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Dhaang Wise Bags & Camera */}
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Dhaang Layers & Proofs</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...consignments];
                          updated[cIdx].dhaange.push({ bags: '', photo: null, previewUrl: '' });
                          setConsignments(updated);
                        }}
                        className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Dhaang Jodein
                      </button>
                    </div>

                    <div className="space-y-2">
                      {c.dhaange.map((d, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-xs font-black text-slate-600 w-16">Layer {dIdx + 1}</span>
                          <input
                            type="number"
                            placeholder="Bags"
                            value={d.bags}
                            onChange={(e) => {
                              const updated = [...consignments];
                              updated[cIdx].dhaange[dIdx].bags = e.target.value;
                              setConsignments(updated);
                            }}
                            className="w-24 p-2 bg-white border rounded-lg text-sm font-bold font-mono"
                          />
                          <label className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold transition ${
                            d.photo ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}>
                            <Camera className="w-4 h-4" />
                            <span>{d.photo ? 'Photo Ready' : 'Snap Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  const updated = [...consignments];
                                  updated[cIdx].dhaange[dIdx].photo = e.target.files[0];
                                  setConsignments(updated);
                                }
                              }}
                            />
                          </label>
                          {c.dhaange.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...consignments];
                                updated[cIdx].dhaange = updated[cIdx].dhaange.filter((_, idx) => idx !== dIdx);
                                setConsignments(updated);
                              }}
                              className="text-rose-500 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setConsignments([...consignments, createNewConsignment()])}
              className="w-full py-3 bg-white border-2 border-dashed border-slate-300 hover:border-emerald-500 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4 text-emerald-600" /> Mixed Maal / Dusri Party Add Karein
            </button>

            {/* Total Bags Live Meter */}
            <div className="bg-slate-950 text-white p-4 rounded-2xl shadow-xl flex justify-between items-center border border-slate-800">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 block">Total Truck Loading</span>
                <span className="text-2xl font-black text-emerald-400 tracking-tight">{calculateTotalBags()} BAGS</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-400">
                <Layers className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            {/* Dharam Kanta Slip (Optional) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Scale className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Dharam Kanta Weight (Optional)</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <input type="number" placeholder="Gross (kg)" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} className="p-2 border rounded-xl text-xs bg-slate-50" />
                <input type="number" placeholder="Tare (kg)" value={tareWeight} onChange={e => setTareWeight(e.target.value)} className="p-2 border rounded-xl text-xs bg-slate-50" />
                <input type="number" placeholder="Net (kg)" value={netWeight} onChange={e => setNetWeight(e.target.value)} className="p-2 border rounded-xl text-xs bg-slate-50 font-bold text-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kanta Parchi Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setKantaSlip(e.target.files[0])}
                  className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white"
                />
              </div>
            </div>

            {/* Final Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-emerald-500/25 transition disabled:opacity-50"
            >
              {loading ? 'UPLOADING RECORD...' : 'SAVE & DESPATCH TRUCK'}
            </button>
          </form>
        )}

        {/* Slips Pending View */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {records.filter(r => r.status === 'slip_pending').length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center border">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="font-bold text-slate-700">Koi bhi pending slip nahi hai!</h3>
                <p className="text-xs text-slate-400 mt-1">Sabhi trucks ki kanta receipt upload ho chuki hai.</p>
              </div>
            ) : (
              records.filter(r => r.status === 'slip_pending').map(r => (
                <div key={r.id} className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-base text-slate-900 font-mono">{r.truck_number}</h4>
                      <p className="text-xs text-slate-500">{r.factory_name} • {r.loading_date}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-1 rounded-md">
                      Slip Pending
                    </span>
                  </div>
                  <div className="pt-2 border-t flex items-center gap-2">
                    <input type="file" id={`slip-${r.id}`} accept="image/*" className="text-xs flex-1" />
                    <button
                      onClick={async () => {
                        const fileInput = document.getElementById(`slip-${r.id}`);
                        if (!fileInput.files[0]) return alert("Pehle photo chunein!");
                        setLoading(true);
                        const url = await compressAndUpload(fileInput.files[0]);
                        await supabase.from('truck_loadings').update({ kanta_slip_url: url, status: 'fully_completed' }).eq('id', r.id);
                        fetchRecords();
                        alert("Slip Updated!");
                      }}
                      className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800"
                    >
                      Attach Slip
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History / Search View */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Search Truck No..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold"
              />
            </div>

            {records.filter(r => r.truck_number.toLowerCase().includes(search.toLowerCase())).map(r => (
              <div key={r.id} className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-base text-slate-900 font-mono">{r.truck_number}</h4>
                    <p className="text-xs text-slate-500">{r.factory_name} • {r.loading_date}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    r.status === 'fully_completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {r.status === 'fully_completed' ? 'Cleared' : 'Slip Pending'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl flex justify-between">
                  <span>Driver: {r.driver_name || 'N/A'}</span>
                  <span>Ph: {r.driver_mobile || 'N/A'}</span>
                </div>

                {role === 'admin' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => generatePDF(r)}
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> Export PDF Slip
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
