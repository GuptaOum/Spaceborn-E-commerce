'use client';
import React, { useState } from 'react';
import { Product, AppView, UserProfile } from '../types';
import { CATEGORIES } from '../data/products';
import { 
  Building2, 
  Plus, 
  Package, 
  DollarSign, 
  CheckCircle2, 
  Store, 
  Zap, 
  Upload, 
  Image as ImageIcon, 
  Eye, 
  Trash2, 
  Layers, 
  TrendingUp, 
  MapPin, 
  ShieldCheck, 
  ChevronRight,
  ArrowRight,
  Sparkles,
  Edit3,
  Clock
} from 'lucide-react';



interface VendorPortalViewProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  onNavigate: (view: AppView) => void;
  user?: UserProfile | null;
}

const SAMPLE_PRESET_IMAGES = [
  { label: 'Arduino Dev Board', url: '/arduino-uno.jpg' },
  { label: 'Raspberry Pi SBC', url: '/raspberry-pi.jpg' },
  { label: 'HC-SR04 Sonar (Silver)', url: '/hc-sr04.jpg' },
  { label: 'HC-SR04 Sonar (Blue)', url: '/hc-sr04-blue.jpg' },
  { label: '360° LiDAR Sensor', url: '/lidar-sensor.jpg' },
  { label: 'N20 Micro Metal Motor', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0jHiFhzcyrFgJgyr2JGnA-MA0qfoSEqiw2nll3M7zYpo4FfhZMOt0LZqLOiJkRjls09xH8rCqZf29RPN8lTZcnrVuy9e-9pNt_q9vf35L5QPlEZBAK5V6H9wnrMa9HCfeDqh6-x6FsXLtVNLOEmn2IRKFdszN8Movn0r2N87BFmGQzISC2K7uU0qHvqJtFQr54SrVgv2BvpG4HaxLKt-zbiCeoq3tScb1zhEA15I3CSVvtmADPTfd' },
  { label: 'ESP32 Wi-Fi Module', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnMVjJT1-pt_AUMIcro80-s0aL2aPVMCoDou9qgbwJANIBVazQ1s39mu2vq1BLesHXaAFSkkpALE_XVjtV3y7azHza4PJbe25tANLFpKG6RPVKvXpoQ_qya7IRJBaN2UcX9MS9fdjvLIdfp1rIlUtIsMMiIjI8RtrobB9REuUC-iURkIpotv160m7Satr4zsxsEt0Inn5LEXj8WMRXDP7zFsw-WcZJ9_KnlsHly_uVy_3HVRHTksl8' },
  { label: 'LiPo Battery Pack', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBf0XjfJbrhdjhg0VbpvLiPKoO99LBFE6uCTP-_KxA7_79w9ZX4bIG2qSK7tzk__a0aXVJYpAy9tla2Ov7NtXgdJVfDe641HkNv20Vvl5U3VkekKeIXRhJKzeftuu1jHEFuFjSWMxrMEBWzVzGVoCz4wX3uPe1r-dzg6i67KrUgOrEVxwrMvACitKF89MRhhIwBWIJ4E0fbLYP1i6X3_HT1VPgLXDdlyk74i4dPl3qv3QR65L3F_qFq' }
];

import { useAuth } from '../context/AuthContext';

export const VendorPortalView: React.FC<VendorPortalViewProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onSelectProduct,
  onNavigate,
  user: initialUser
}) => {
  const { user: authUser, vendorStore } = useAuth();
  const user = authUser || initialUser;

  const [activeTab, setActiveTab] = useState<'inventory' | 'add_product' | 'hubs'>('add_product');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for Putting New Product
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Development Boards');
  const [subCategory, setSubCategory] = useState('Microcontrollers');
  const [brand, setBrand] = useState('Spaceborn Verified');
  const [sku, setSku] = useState('');
  const [hsn, setHsn] = useState('85423100');
  const [price, setPrice] = useState<number>(299);
  const [originalPrice, setOriginalPrice] = useState<number>(399);
  const [stock, setStock] = useState<number>(1000);
  const [deliveryMins, setDeliveryMins] = useState<number>(10);
  const [voltage, setVoltage] = useState('5V');
  const [image, setImage] = useState(SAMPLE_PRESET_IMAGES[0].url);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [feature1, setFeature1] = useState('');
  const [feature2, setFeature2] = useState('');
  const [packageItem, setPackageItem] = useState('');

  // Auto-generate a realistic SKU based on category & name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!sku || sku.startsWith('VND-')) {
      const slug = val
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6);
      setSku(`VND-${slug || 'ITEM'}-${Math.floor(100 + Math.random() * 900)}`);
    }
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please provide a product title');
      return;
    }

    const finalImage = customImageUrl.trim() || image;

    const newProduct: Product = {
      id: `vnd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      vendorId: currentVendorId || `vnd-${user?.id || 'partner'}`,
      vendorName: vendorStore?.storeName || user?.companyName || user?.fullName || 'Spaceborn Verified Seller',
      city: vendorStore?.city || 'Kanpur Hub',
      name: name.trim(),
      sku: sku.trim() || `VND-${Date.now().toString().slice(-6)}`,
      category: category,
      subCategory: subCategory.trim() || 'General',
      price: Number(price) || 99,
      originalPrice: Number(originalPrice) || Number(price) * 1.25,
      hsn: hsn.trim() || '85423100',
      gstRate: 18,
      stock: Number(stock) || 500,
      rating: 5.0,
      reviewsCount: 1,
      image: finalImage,
      gallery: [finalImage],
      description: description.trim() || `${name} supplied by Spaceborn Verified Partner. Tested for immediate dark store dispatch.`,
      features: [
        feature1.trim() || 'Genuine manufacturer grade certified',
        feature2.trim() || 'Compatible with standard breadboards and microcontrollers',
        '100% Quality Inspected before dispatch'
      ],
      brand: brand.trim() || 'Spaceborn Partner',
      voltage: voltage,
      packageIncludes: [packageItem.trim() || `1 x ${name}`],
      specifications: {
        'Operating Voltage': voltage || '3.3V - 5V',
        'Vendor Status': 'Verified Business Partner',
        'Fulfillment': 'Spaceborn Express Dark Store Hub'
      },
      deliveryMins: deliveryMins,
      badge: 'New Arrival'
    };

    onAddProduct(newProduct);
    setSuccessMessage(`"${newProduct.name}" has been published to Spaceborn! Shoppers can now buy it.`);
    
    // Reset form
    setName('');
    setSku('');
    setDescription('');
    setFeature1('');
    setFeature2('');
    setPackageItem('');
    setCustomImageUrl('');

    // Switch to inventory to view it
    setTimeout(() => {
      setActiveTab('inventory');
    }, 1200);
  };

  // Derive vendor-specific products (strictly isolated to this vendor only)
  const currentVendorId = vendorStore?.id || user?.id;
  const vendorProducts = currentVendorId 
    ? products.filter(p => p.vendorId === currentVendorId || p.vendorId === user?.id || (user?.email && p.vendorId === user.email))
    : [];

  // Stats calculation strictly scoped to this vendor
  const totalInventoryUnits = vendorProducts.reduce((acc, p) => acc + p.stock, 0);
  const totalCatalogValue = vendorProducts.reduce((acc, p) => acc + p.price * p.stock, 0);

  if (!user || user.role !== 'vendor') {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center bg-[#fffbf7] px-4 py-12">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-[#f9bf8f]/60 p-8 sm:p-10 shadow-lg text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#f2fcf4] border border-[#0c831f]/20 text-[#0c831f] flex items-center justify-center mx-auto shadow-xs">
            <Store className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0c831f] bg-[#f2fcf4] px-3 py-1 rounded-full border border-[#0c831f]/20">
              Verified Seller Network
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#34222e] mt-3">
              Spaceborn Partner & Seller Hub
            </h2>
            <p className="text-xs sm:text-sm text-[#7a6274] mt-2 leading-relaxed">
              Are you a component manufacturer, electronics distributor, or local maker shop? Sell your hardware directly through Spaceborn's 10-15 minute dark store network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="p-3.5 rounded-2xl bg-[#fee9d7]/30 border border-[#f9bf8f]/40">
              <Zap className="w-4 h-4 text-[#e2434b] mb-1.5" />
              <p className="text-xs font-bold text-[#34222e]">10-Min Delivery</p>
              <p className="text-[11px] text-[#7a6274] mt-0.5">Instant dispatch across active hubs</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#fee9d7]/30 border border-[#f9bf8f]/40">
              <ShieldCheck className="w-4 h-4 text-[#0c831f] mb-1.5" />
              <p className="text-xs font-bold text-[#34222e]">Full Isolation</p>
              <p className="text-[11px] text-[#7a6274] mt-0.5">Manage only your inventory & pricing</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#fee9d7]/30 border border-[#f9bf8f]/40">
              <TrendingUp className="w-4 h-4 text-[#0c831f] mb-1.5" />
              <p className="text-xs font-bold text-[#34222e]">Zero Listing Fee</p>
              <p className="text-[11px] text-[#7a6274] mt-0.5">Fast weekly GST-compliant payouts</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#f9bf8f]/30 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => onNavigate('auth')}
              className="flex-1 py-3 bg-[#0c831f] hover:bg-[#0a6e1a] text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-md shadow-[#0c831f]/20 cursor-pointer"
            >
              Sign In with Vendor Account
            </button>
            <button 
              onClick={() => onNavigate('catalog')}
              className="py-3 px-5 bg-white border border-[#f9bf8f] text-[#34222e] hover:bg-[#fee9d7]/50 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              Return to Store
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (vendorStore?.status === 'pending') {
    return (
      <div className="min-h-[70vh] bg-[#fee9d7] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/40 p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-[#fee9d7] text-[#0c831f] rounded-full flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#34222e] mb-2">Application Under Review</h2>
          <p className="text-sm text-[#7a6274] leading-relaxed mb-6">
            Your vendor application for <span className="font-semibold text-[#34222e]">{vendorStore.storeName}</span> in {vendorStore.city} is currently under verification by our Admin team. You will be able to publish products once approved!
          </p>
          <button 
            onClick={() => onNavigate('catalog')}
            className="w-full py-3 bg-[#34222e] text-white rounded-xl text-sm font-bold hover:bg-[#1f141b] transition cursor-pointer"
          >
            Return to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fee9d7] text-[#34222e] py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 space-y-6">

        {/* Top Breadcrumb & Dual Persona Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-[#7a6274]">
            <span 
              onClick={() => onNavigate('home')} 
              className="hover:text-[#e2434b] cursor-pointer"
            >
              Home
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#7a6274]" />
            <span className="font-bold text-[#34222e]">Vendor & Business Seller Portal</span>
          </div>

          {/* Quick Switch to Shopper Mode */}
          <button
            onClick={() => onNavigate('catalog')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#fee9d7] border border-[#f9bf8f] text-[#34222e] font-bold text-xs transition cursor-pointer self-start sm:self-auto shadow-xs active:scale-95"
          >
            <span>🛒 Switch to Shopper Store</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0c831f]" />
          </button>
        </div>

        {/* Hero Header */}
        <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f2fcf4] text-[#0c831f] text-xs font-bold border border-[#0c831f]/20">
              <Store className="w-3.5 h-3.5" />
              <span>Spaceborn Verified Partner & Seller Network</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#34222e] tracking-tight">
              Put Your Products into Spaceborn Quick-Commerce
            </h1>
            <p className="text-xs sm:text-sm text-[#7a6274] leading-relaxed">
              Are you a hardware vendor, distributor, or maker business? List your components directly to our 10-15 minute dark stores across Kanpur, Delhi, Bengaluru, Noida, Pune, and Chennai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('add_product')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
                activeTab === 'add_product'
                  ? 'bg-[#0c831f] text-white'
                  : 'bg-white text-[#34222e] border border-[#f9bf8f]/60 hover:bg-[#fee9d7]'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Put New Product</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
                activeTab === 'inventory'
                  ? 'bg-[#0c831f] text-white'
                  : 'bg-white text-[#34222e] border border-[#f9bf8f]/60 hover:bg-[#fee9d7]'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Manage Catalog ({vendorProducts.length})</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#fffbf7] border border-[#f9bf8f]/60 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-[#7a6274] block">Active Listed SKUs</span>
            <span className="text-2xl font-black text-[#34222e] mt-1 block font-mono">
              {vendorProducts.length} Items
            </span>
            <span className="text-[10px] text-[#0c831f] font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Live on Store</span>
            </span>
          </div>

          <div className="bg-[#fffbf7] border border-[#f9bf8f]/60 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-[#7a6274] block">Dark Store Inventory</span>
            <span className="text-2xl font-black text-[#0c831f] mt-1 block font-mono">
              {totalInventoryUnits.toLocaleString('en-IN')} Pcs
            </span>
            <span className="text-[10px] text-[#7a6274] font-medium block mt-1">
              Across 6 city fulfillment hubs
            </span>
          </div>

          <div className="bg-[#fffbf7] border border-[#f9bf8f]/60 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-[#7a6274] block">Inventory Valuation</span>
            <span className="text-2xl font-black text-[#34222e] mt-1 block font-mono">
              ₹{(totalCatalogValue / 100000).toFixed(1)} Lakhs
            </span>
            <span className="text-[10px] text-[#e2434b] font-semibold block mt-1">
              With 18% GST Input Credit
            </span>
          </div>

          <div className="bg-[#fffbf7] border border-[#f9bf8f]/60 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-[#7a6274] block">Fulfillment Speed</span>
            <span className="text-2xl font-black text-[#e2434b] mt-1 block flex items-center gap-1">
              <Zap className="w-5 h-5 fill-[#e2434b]" />
              <span>10-15 Min</span>
            </span>
            <span className="text-[10px] text-[#0c831f] font-semibold block mt-1">
              Guaranteed instant delivery
            </span>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'add_product' ? (
          /* TAB 1: PUT / LIST NEW PRODUCT FORM */
          <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-[#f9bf8f]/40 pb-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#0c831f] mb-1">
                <Plus className="w-4 h-4" />
                <span>Instant Vendor Listing Form</span>
              </div>
              <h2 className="text-xl font-bold text-[#34222e]">
                Put a Component on Spaceborn
              </h2>
              <p className="text-xs text-[#7a6274] mt-1">
                Fill out the technical and pricing specifications below. Your product will immediately be discoverable by makers, engineering labs, and students across India.
              </p>
            </div>

            {successMessage && (
              <div className="p-4 bg-[#f2fcf4] border border-[#0c831f]/30 rounded-2xl flex items-center justify-between text-xs text-[#0c831f] font-bold animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{successMessage}</span>
                </div>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <form onSubmit={handlePublish} className="space-y-6">
              
              {/* Row 1: Title, Category, Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Product Title / Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raspberry Pi RP2040 Microcontroller Board with Type-C"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#f9bf8f]/80 rounded-2xl text-xs font-medium text-[#34222e] outline-none focus:border-[#0c831f] focus:ring-1 focus:ring-[#0c831f] shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#f9bf8f]/80 rounded-2xl text-xs font-semibold text-[#34222e] outline-none focus:border-[#0c831f] cursor-pointer shadow-xs"
                  >
                    {CATEGORIES.filter(c => c.name !== 'All Categories').map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Subcategory, Brand, SKU, HSN */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 32-bit MCU"
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Waveshare / SparkFun"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    SKU / Part Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VND-RP2040-01"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs font-mono text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    HSN Code (GST)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 85423100"
                    value={hsn}
                    onChange={(e) => setHsn(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs font-mono text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                </div>
              </div>

              {/* Row 3: Pricing, Stock, ETA, Voltage */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#fee9d7]/40 rounded-2xl border border-[#f9bf8f]/60">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Selling Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-[#7a6274]">₹</span>
                    <input
                      type="number"
                      required
                      min="1"
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs font-bold text-[#34222e] outline-none focus:border-[#0c831f]"
                    />
                  </div>
                  <span className="text-[10px] text-[#7a6274]">Incl. 18% GST</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Original MRP (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-[#7a6274]">₹</span>
                    <input
                      type="number"
                      min="1"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(parseInt(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs font-bold text-[#7a6274] outline-none focus:border-[#0c831f]"
                    />
                  </div>
                  <span className="text-[10px] text-[#e2434b]">Shows discount tag</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Dark Store Stock (Units) *
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs font-bold text-[#0c831f] outline-none focus:border-[#0c831f]"
                  />
                  <span className="text-[10px] text-[#0c831f]">Immediate dispatch units</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Delivery Speed
                  </label>
                  <select
                    value={deliveryMins}
                    onChange={(e) => setDeliveryMins(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs font-bold text-[#0c831f] outline-none focus:border-[#0c831f] cursor-pointer"
                  >
                    <option value={10}>⚡ 10 Minutes</option>
                    <option value={15}>⚡ 15 Minutes</option>
                    <option value={20}>⚡ 20 Minutes</option>
                  </select>
                  <span className="text-[10px] text-[#7a6274]">Dark store radius</span>
                </div>
              </div>

              {/* Row 4: Image Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#34222e] block">
                  Select Product Image Preset or Provide URL
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {SAMPLE_PRESET_IMAGES.map((preset, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setImage(preset.url);
                        setCustomImageUrl('');
                      }}
                      className={`p-1.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                        image === preset.url && !customImageUrl
                          ? 'border-2 border-[#0c831f] bg-[#f2fcf4] shadow-xs'
                          : 'border-[#f9bf8f]/60 bg-white hover:bg-[#fee9d7]/50'
                      }`}
                    >
                      <div className="w-12 h-12 flex items-center justify-center p-1">
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-[#34222e] line-clamp-1 mt-1">
                        {preset.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <input
                    type="text"
                    placeholder="Or enter a custom Image URL (https://... or /image.jpg)"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                </div>
              </div>

              {/* Row 5: Description & Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Short Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="High quality dual-core RP2040 chip board running up to 133MHz with 2MB flash..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-white border border-[#f9bf8f]/80 rounded-2xl text-xs text-[#34222e] outline-none focus:border-[#0c831f] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#34222e] block">
                    Key Features & Package Contents
                  </label>
                  <input
                    type="text"
                    placeholder="Feature 1 (e.g. 26 Multi-function GPIO pins)"
                    value={feature1}
                    onChange={(e) => setFeature1(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                  <input
                    type="text"
                    placeholder="Feature 2 (e.g. Drag-and-drop programming using mass storage over USB)"
                    value={feature2}
                    onChange={(e) => setFeature2(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                  <input
                    type="text"
                    placeholder="Package Includes (e.g. 1 x RP2040 Board, 2 x 20-Pin Male Headers)"
                    value={packageItem}
                    onChange={(e) => setPackageItem(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#f9bf8f]/80 rounded-xl text-xs text-[#34222e] outline-none focus:border-[#0c831f]"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-[#f9bf8f]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-2 text-xs text-[#7a6274]">
                  <ShieldCheck className="w-4 h-4 text-[#0c831f]" />
                  <span>Product immediately added to Spaceborn catalog for 10-min delivery</span>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-7 py-3 bg-[#0c831f] hover:bg-[#0a6e1a] text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md shadow-[#0c831f]/20 flex items-center justify-center space-x-2 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Publish Component to Spaceborn</span>
                </button>
              </div>

            </form>
          </div>
        ) : (
          /* TAB 2: INVENTORY & CATALOG MANAGER */
          <div className="bg-[#fffbf7] rounded-3xl border border-[#f9bf8f]/60 p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f9bf8f]/40">
              <div>
                <h2 className="text-lg font-bold text-[#34222e]">
                  Active Hardware Catalog ({vendorProducts.length} Products)
                </h2>
                <p className="text-xs text-[#7a6274] mt-0.5">
                  Update inventory counts, adjust prices, or view how items appear to quick-commerce shoppers.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('add_product')}
                className="px-4 py-2 bg-[#0c831f] hover:bg-[#0a6e1a] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Product</span>
              </button>
            </div>

            {/* Products Table or Empty State */}
            {vendorProducts.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-[#f9bf8f]/40 space-y-3">
                <Package className="w-12 h-12 text-[#f9bf8f] mx-auto" />
                <h3 className="text-sm font-bold text-[#34222e]">No Components Listed Yet</h3>
                <p className="text-xs text-[#7a6274] max-w-sm mx-auto">
                  Your store catalog is currently empty. Put your first microcontroller, sensor, or battery pack to start receiving orders!
                </p>
                <button
                  onClick={() => setActiveTab('add_product')}
                  className="px-4 py-2 bg-[#0c831f] text-white text-xs font-bold rounded-xl hover:bg-[#0a6e1a] transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>List Your First Component</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#f9bf8f]/30 border border-[#f9bf8f]/40 rounded-2xl overflow-hidden bg-white">
                {vendorProducts.map((p) => (
                  <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fee9d7]/20 transition">
                    {/* Left: Image & Info */}
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      <div className="w-14 h-14 rounded-xl bg-white border border-[#f9bf8f]/40 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2 text-[10px] text-[#7a6274]">
                          <span className="font-bold text-[#e2434b] uppercase">{p.brand}</span>
                          <span>•</span>
                          <span className="font-mono">SKU: {p.sku}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#34222e]">{p.category}</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#34222e] truncate mt-0.5">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-[#0c831f] bg-[#f2fcf4] px-2 py-0.5 rounded border border-[#0c831f]/20">
                            ⚡ {p.deliveryMins || 10} MINS ETA
                          </span>
                          <span className="text-[10px] text-[#7a6274]">
                            HSN: {p.hsn}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Stock Controls */}
                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#34222e] block">
                          Stock in Dark Store
                        </span>
                        <div className="flex items-center space-x-1.5 mt-1">
                          <button
                            onClick={() => onUpdateProduct({ ...p, stock: Math.max(0, p.stock - 50) })}
                            className="w-6 h-6 rounded bg-[#fee9d7] hover:bg-[#f9bf8f] text-[#34222e] font-bold text-xs flex items-center justify-center transition cursor-pointer"
                            title="-50 Pcs"
                          >
                            -
                          </button>
                          <span className="font-mono font-black text-xs text-[#0c831f] w-16 text-center">
                            {p.stock} pcs
                          </span>
                          <button
                            onClick={() => onUpdateProduct({ ...p, stock: p.stock + 100 })}
                            className="w-6 h-6 rounded bg-[#fee9d7] hover:bg-[#f9bf8f] text-[#34222e] font-bold text-xs flex items-center justify-center transition cursor-pointer"
                            title="+100 Pcs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Price & View Live & Delete */}
                    <div className="flex items-center space-x-2 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-[#f9bf8f]/30">
                      <div className="text-right pr-2">
                        <span className="text-sm font-black text-[#34222e] block font-mono">
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                        {p.originalPrice && p.originalPrice > p.price && (
                          <span className="text-[10px] text-[#7a6274] line-through block">
                            ₹{p.originalPrice}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          onSelectProduct(p);
                          onNavigate('product');
                        }}
                        className="px-3 py-1.5 bg-[#fee9d7]/70 hover:bg-[#fee9d7] text-[#34222e] border border-[#f9bf8f] rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                        title="View as customer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#0c831f]" />
                        <span>View Live</span>
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to remove "${p.name}" from your catalog?`)) {
                            onDeleteProduct(p.id);
                          }
                        }}
                        className="p-1.5 text-[#7a6274] hover:text-[#e2434b] hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Delete component"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
