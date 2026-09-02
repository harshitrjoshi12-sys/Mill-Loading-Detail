import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import imageCompression from 'browser-image-compression';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Truck, Plus, Trash2, Camera, Search, FileText, Building2, Scale
} from 'lucide-react';

const FACTORIES = ["Pragya Products", "Shreeram Agro Product"];
const ITEMS = ["Mogar", "Mogar Polish", "Moong Dal", "Chilka", "Churi", "Moong Grading", "Other (Custom)"];
const MARKAS = ["Shreeram", "Pragya", "Plain", "Sunrise", "Dolphin", "Titanic", "Rajhans", "Chetak", "Star", "Other (Custom)"];
const PACKING_SIZES = ["50 kg", "40 kg", "30 kg", "25 kg", "Other (Custom)"];
const COUNTS = ["None / Blank", "500 count", "550 count", "600 count", "700 count", "750 count", "Other (Custom)"];

export default function App() {
  const [role, setRole] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState('new');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [factory, setFactory] = useState(FACTORIES[0]);
  const [truckNo, setTruckNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [consignments, setConsignments] = useState([createNewConsignment()]);
  
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [kantaSlipFile, setKantaSlipFile] = useState(null);

  function createNewConsignment() {
    return {
      partyName: '',
      item: ITEMS[0],
      marka: MARKAS[0],
      packing: PACKING_SIZES[0],
      count: COUNTS[0],
      moisture: '',
      dhaange: [{ bags: '', photo: null, photoUrl: '' }]
    };
  }

  useEffect(() => {
    if (role) fetchRecords();
  }, [role]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === '1111') {
      setRole('munim');
      setPinError('');
    } else if (pinInput === '9999') {
      setRole('admin');
      setPinError('');
    } else {
      setPinError('Galat PIN! Dubara koshish karein.');
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('truck_loadings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setRecords(data || []);
    setLoading(false);
  };

  const compressAndUploadImage = async (file) => {
    if (!file) return null;
    const options = { maxSizeMB: 0.4, maxWidthOrHeight: 1280, useWebWorker: true };
    try {
      const compressed = await imageCompression(file, options);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from('loading-photos').upload(fileName, compressed);
      if (error) throw error;
      const { data } = supabase.storage.from('loading-photos').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  };

  const handleDhaangPhotoUpload = async (cIndex, dIndex, file) => {
    const updated = [...consignments];
    updated[cIndex].dhaange[dIndex].photo = file;
    setConsignments(updated);
  };

  const handleAddDhaang = (cIndex) => {
    const updated = [...consignments];
    updated[cIndex].dhaange.push({ bags: '', photo: null, photoUrl: '' });
    setConsignments(updated);
  };

  const handleRemoveDhaang = (cIndex, dIndex) => {
    const updated = [...consignments];
    updated[cIndex].dhaange = updated[cIndex].dhaange.filter((_, idx) => idx !== dIndex);
    setConsignments(updated);
  };

  const handleAddConsignment = () => {
    setConsignments([...consignments, createNewConsignment()]);
  };

  const handleRemoveConsignment = (index) => {
    setConsignments(consignments.filter((_, idx) => idx !== index));
  };

  const calculateTotalBags = () => {
    return consignments.reduce((sum, c) => {
      return sum + c.dhaange.reduce((dSum, d) => dSum + (Number(d.bags) || 0), 0);
    }, 0);
  };

  const handleSubmitLoading = async (e) => {
    e.preventDefault();
    if (!truckNo.trim()) return alert("Kripya Truck Number bharein!");
    setLoading(true);

    try {
      const processedConsignments = await Promise.all(
        consignments.map(async (c) => {
          const updatedDhaange = await Promise.all(
            c.dhaange.map(async (d) => {
              let photoUrl = d.photoUrl;
              if (d.photo) {
                photoUrl = await compressAndUploadImage(d.photo);
              }
              return { bags: Number(d.bags) || 0, photoUrl };
            })
          );
          return { ...c, dhaange: updatedDhaange };
        })
      );

      let slipUrl = null;
      if (kantaSlipFile) {
        slipUrl = await compressAndUploadImage(kantaSlipFile);
      }

      const status = slipUrl ? 'fully_completed' : 'slip_pending';

      const payload = {
        factory_name: factory,
        truck_number: truckNo.toUpperCase(),
        driver_name: driverName,
        driver_mobile: driverMobile,
        loading_date: new Date().toISOString().split('T')[0],
        consignments: processedConsignments,
        gross_weight: grossWeight ? Number(grossWeight) : null,
        tare_weight: tareWeight ? Number(tareWeight) : null,
        net_weight: netWeight ? Number(netWeight) : null,
        kanta_slip_url: slipUrl,
        status,
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
      setKantaSlipFile(null);
      fetchRecords();
      setActiveTab('history');
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSlip = async (id, slipFile) => {
    setLoading(true);
    try {
      const slipUrl = await compressAndUploadImage(slipFile);
      const { error } = await supabase
        .from('truck_loadings')
        .update({
          kanta_slip_url: slipUrl,
          status: 'fully_completed'
        })
        .eq('id', id);
      if (error) throw error;
      alert("Kanta slip successfully attach ho gayi!");
      fetchRecords();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (record) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(record.factory_name, 14, 20);
    doc.setFontSize(12);
    doc.text(`Mill Loading Summary Slip`, 14, 28);
    doc.line(14, 30, 196, 30);

    doc.setFontSize(10);
    doc.text(`Truck No: ${record.truck_number}`, 14, 38);
    doc.text(`Date: ${record.loading_date}`, 140, 38);
    doc.text(`Driver: ${record.driver_name || 'N/A'} (${record.driver_mobile || 'N/A'})`, 14, 46);

    let currentY = 56;

    record.consignments.forEach((c) => {
      doc.setFontSize(11);
      doc.text(`Party: ${c.partyName || 'N/A'} | Maal: ${c.item} | Marka: ${c.marka} | Packing: ${c.packing}`, 14, currentY);
      currentY += 6;
      doc.setFontSize(9);
      doc.text(`Count: ${c.count} | Moisture: ${c.moisture ? c.moisture + '%' : 'N/A'}`, 14, currentY);
      currentY += 8;

      const tableData = c.dhaange.map((d, dIdx) => [
        `Dhaang ${dIdx + 1}`,
        `${d.bags} Bags`,
        d.photoUrl ? 'Photo Uploaded' : 'No Photo'
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Dhaang Layer', 'Bag Count', 'Proof Status']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 }
      });

      currentY = doc.lastAutoTable.finalY + 10;
    });

    doc.setFontSize(10);
    doc.text(`Weight: Gross: ${record.gross_weight || 'N/A'} kg | Tare: ${record.tare_weight || 'N/A'} kg | Net: ${record.net_weight || 'N/A'} kg`, 14, currentY);
    doc.save(`Loading_${record.truck_number}_${record.loading_date}.pdf`);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-700 text-center">
          <Truck className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Mill Loading Detail</h1>
          <p className="text-slate-400 text-sm mb-6">Enter PIN to access terminal</p>
          <input
            type="password"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            className="w-full text-center tracking-widest text-3xl py-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-emerald-400 mb-4"
          />
          {pinError && <p className="text-rose-400 text-xs mb-4">{pinError}</p>}
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-semibold transition">
            Login
          </button>
          <p className="text-slate-500 text-xs mt-4">Munim PIN: 1111 | Admin PIN: 9999</p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Truck className="text-emerald-400 w-5 h-5" /> Mill Loading Detail
          </h1>
          <span className="text-xs text-slate-400 uppercase tracking-wide">Mode: {role}</span>
        </div>
        <button onClick={() => setRole(null)} className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-700">
          Logout
        </button>
      </header>

      <nav className="flex bg-white border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('new')} 
          className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center ${activeTab === 'new' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'}`}
        >
          + Naya Truck
        </button>
        <button 
          onClick={() => setActiveTab('pending')} 
          className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center ${activeTab === 'pending' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'}`}
        >
          Slip Pending
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex-1 py-3 text-sm font-semibold border-b-2 text-center ${activeTab === 'history' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'}`}
        >
          History & Search
        </button>
      </nav>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        {activeTab === 'new' && (
          <form onSubmit={handleSubmitLoading} className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" /> Basic Truck Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Factory Name</label>
                  <select value={factory} onChange={(e) => setFactory(e.target.value)} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-lg">
                    {FACTORIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Truck Number *</label>
                  <input type="text" placeholder="e.g. RJ 21 GA 1234" value={truckNo} onChange={(e) => setTruckNo(e.target.value)} required className="w-full mt-1 p-2.5 bg-slate-50 border rounded-lg uppercase" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Driver Name</label>
                  <input type="text" placeholder="Driver Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Driver Mobile</label>
                  <input type="tel" placeholder="Mobile Number" value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} className="w-full mt-1 p-2.5 bg-slate-50 border rounded-lg" />
                </div>
              </div>
            </div>

            {consignments.map((c, cIdx) => (
              <div key={cIdx} className="bg-white p-5 rounded-xl shadow-sm border border-emerald-200 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-slate-800">Part {cIdx + 1}: Party & Maal Detail</h3>
                  {consignments.length > 1 && (
                    <button type="button" onClick={() => handleRemoveConsignment(cIdx)} className="text-rose-500 hover:text-rose-700 text-sm flex items-center gap-1">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Party / Grahak Name</label>
                    <input type="text" placeholder="Party Name" value={c.partyName} onChange={(e) => {
                      const updated = [...consignments];
                      updated[cIdx].partyName = e.target.value;
                      setConsignments(updated);
                    }} className="w-full mt-1 p-2 bg-slate-50 border rounded-lg" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Maal Type</label>
                    <select value={c.item} onChange={(e) => {
                      const updated = [...consignments];
                      updated[cIdx].item = e.target.value;
                      setConsignments(updated);
                    }} className="w-full mt-1 p-2 bg-slate-50 border rounded-lg">
                      {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Bag Marka</label>
                    <select value={c.marka} onChange={(e) => {
                      const updated = [...consignments];
                      updated[cIdx].marka = e.target.value;
                      setConsignments(updated);
                    }} className="w-full mt-1 p-2 bg-slate-50 border rounded-lg">
                      {MARKAS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Packing Size</label>
                    <select value={c.packing} onChange={(e) => {
                      const updated = [...consignments];
                      updated[cIdx].packing = e.target.value;
                      setConsignments(updated);
                    }} className="w-full mt-1 p-2 bg-slate-50 border rounded-lg">
                      {PACKING_SIZES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Maal Count (Optional)</label>
                    <select value={c.count} onChange={(e) => {
                      const updated = [...consignments];
                      updated[cIdx].count = e.target.value;
                      setConsignments(updated);
                    }} className="w-full mt-1 p-2 bg-slate-50 border rounded-lg">
                      {COUNTS.map(cnt => <option key={cnt} value={cnt}>{cnt}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Moisture % (Optional)</label>
                    <input type="number" step="0.1" placeholder="e.g. 11.5" value={c.moisture} onChange={(e) => {
                      const updated = [...consignments];
                      updated[cIdx].moisture = e.target.value;
                      setConsignments(updated);
                    }} className="w-full mt-1 p-2 bg-slate-50 border rounded-lg" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t">
                  <h4 className="text-xs font-bold text-slate-600 mb-2">Dhaange (Layer Wise Bags & Photos)</h4>
                  <div className="space-y-3">
                    {c.dhaange.map((d, dIdx) => (
                      <div key={dIdx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border">
                        <span className="font-semibold text-sm w-20">Dhaang {dIdx + 1}</span>
                        <input
                          type="number"
                          placeholder="Bags"
                          value={d.bags}
                          onChange={(e) => {
                            const updated = [...consignments];
                            updated[cIdx].dhaange[dIdx].bags = e.target.value;
                            setConsignments(updated);
                          }}
                          className="w-28 p-2 border rounded-lg bg-white"
                        />
                        <label className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg cursor-pointer hover:bg-emerald-100 text-sm">
                          <Camera className="w-4 h-4" />
                          <span>{d.photo ? 'Photo Added' : 'Take Photo'}</span>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleDhaangPhotoUpload(cIdx, dIdx, e.target.files[0])} />
                        </label>
                        {c.dhaange.length > 1 && (
                          <button type="button" onClick={() => handleRemoveDhaang(cIdx, dIdx)} className="text-rose-500 hover:text-rose-700 p-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => handleAddDhaang(cIdx)} className="mt-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add Dhaang
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={handleAddConsignment} className="w-full py-2.5 border-2 border-dashed border-emerald-400 text-emerald-700 bg-emerald-50 rounded-xl font-semibold hover:bg-emerald-100 transition">
              + Add Another Party / Mixed Maal
            </button>

            <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
              <span className="text-sm font-medium">Total Truck Bags:</span>
              <span className="text-2xl font-bold text-emerald-400">{calculateTotalBags()} Bags</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" /> Dharam Kanta / Weight Bridge (Optional)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" placeholder="Gross Wt (kg)" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className="p-2 border rounded-lg bg-slate-50" />
                <input type="number" placeholder="Tare Wt (kg)" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} className="p-2 border rounded-lg bg-slate-50" />
                <input type="number" placeholder="Net Wt (kg)" value={netWeight} onChange={(e) => setNetWeight(e.target.value)} className="p-2 border rounded-lg bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kanta Receipt Photo</label>
                <input type="file" accept="image/*" onChange={(e) => setKantaSlipFile(e.target.files[0])} className="text-sm" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50">
              {loading ? 'Data Upload Ho Raha Hai...' : 'Save Truck Loading'}
            </button>
          </form>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-4">
            <h2 className="font-bold text-slate-700">Kanta Slip Pending Trucks</h2>
            {records.filter(r => r.status === 'slip_pending').length === 0 ? (
              <p className="text-sm text-slate-500">Koi bhi pending slip nahi hai.</p>
            ) : (
              records.filter(r => r.status === 'slip_pending').map(record => (
                <div key={record.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 text-base">{record.truck_number}</span>
                      <p className="text-xs text-slate-500">{record.factory_name} | {record.loading_date}</p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-1 rounded">Slip Pending</span>
                  </div>
                  <div className="border-t pt-3 flex flex-wrap gap-2 items-center">
                    <input type="file" id={`slip-${record.id}`} accept="image/*" className="text-xs" />
                    <button 
                      onClick={() => {
                        const fileInput = document.getElementById(`slip-${record.id}`);
                        if (fileInput.files[0]) {
                          handleUpdateSlip(record.id, fileInput.files[0]);
                        } else {
                          alert("Pehle photo select karein!");
                        }
                      }}
                      className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-semibold hover:bg-emerald-700"
                    >
                      Attach Kanta Slip
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Truck No. se search karein..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border rounded-xl text-sm"
              />
            </div>

            <div className="space-y-3">
              {records
                .filter(r => r.truck_number.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-xl border shadow-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800">{r.truck_number}</h3>
                        <p className="text-xs text-slate-500">{r.factory_name} • {r.loading_date}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${r.status === 'fully_completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {r.status === 'fully_completed' ? 'Completed' : 'Slip Pending'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                      Driver: {r.driver_name || 'N/A'} ({r.driver_mobile || 'N/A'})
                    </div>

                    {role === 'admin' && (
                      <div className="pt-2 flex justify-end">
                        <button onClick={() => generatePDF(r)} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-slate-800">
                          <FileText className="w-3.5 h-3.5" /> Download PDF Slip
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
