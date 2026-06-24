import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:3000";

export default function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  const fetchData = async () => {
    try {
      const [prodRes, orderRes] = await Promise.all([
        axios.get(`${API}/api/products`),
        axios.get(`${API}/api/orders`),
      ]);
      setProducts(prodRes.data);
      setOrders(orderRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const syncProducts = async () => {
    setSyncing(true);
    try {
      await axios.get(`${API}/api/products/sync`);
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Group products by SKU
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.sku]) acc[product.sku] = {};
    acc[product.sku][product.store_origin] = product;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Multistore Dashboard</h1>
            <p className="text-gray-400 text-sm">Store A (INR) + Store B (AED)</p>
          </div>
          <button
            onClick={syncProducts}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {syncing ? "Syncing..." : "🔄 Sync Now"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Total Products</p>
          <p className="text-3xl font-bold">{products.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Store A (INR)</p>
          <p className="text-3xl font-bold text-green-400">
            {products.filter(p => p.store_origin === "store_a").length}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-sm">Store B (AED)</p>
          <p className="text-3xl font-bold text-blue-400">
            {products.filter(p => p.store_origin === "store_b").length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex gap-4 border-b border-gray-800 mb-6">
          {["products", "orders"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-2 text-sm font-medium capitalize transition border-b-2 ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab === "products" ? "📦 Product Catalog" : "🛒 Order Feed"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : activeTab === "products" ? (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Store A Price (INR)</th>
                  <th className="text-left px-4 py-3">Store A Stock</th>
                  <th className="text-left px-4 py-3">Store B Price (AED)</th>
                  <th className="text-left px-4 py-3">Store B Stock</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedProducts).map(([sku, stores], i) => (
                  <tr key={sku} className={i % 2 === 0 ? "bg-gray-950" : "bg-gray-900"}>
                    <td className="px-4 py-3 font-mono text-yellow-400">{sku}</td>
                    <td className="px-4 py-3 font-medium">
                      {stores.store_a?.title || stores.store_b?.title}
                    </td>
                    <td className="px-4 py-3 text-green-400">
                      {stores.store_a ? `₹${stores.store_a.price}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {stores.store_a ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          stores.store_a.inventory > 20
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300"
                        }`}>
                          {stores.store_a.inventory} units
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-blue-400">
                      {stores.store_b ? `AED ${stores.store_b.price}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {stores.store_b ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          stores.store_b.inventory > 20
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300"
                        }`}>
                          {stores.store_b.inventory} units
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            {orders.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                No orders yet. Orders will appear here when webhooks fire.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3">Order ID</th>
                    <th className="text-left px-4 py-3">Store</th>
                    <th className="text-left px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => (
                    <tr key={order.id} className={i % 2 === 0 ? "bg-gray-950" : "bg-gray-900"}>
                      <td className="px-4 py-3 font-mono text-yellow-400">#{order.shopify_order_id}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.store_origin === "store_a"
                            ? "bg-green-900 text-green-300"
                            : "bg-blue-900 text-blue-300"
                        }`}>
                          {order.store_origin === "store_a" ? "Store A (INR)" : "Store B (AED)"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {order.currency} {order.total_price}
                      </td>
                      <td className="px-4 py-3 capitalize">{order.status}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}