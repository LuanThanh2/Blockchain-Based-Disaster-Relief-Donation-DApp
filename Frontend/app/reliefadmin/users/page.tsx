"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type User = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  wallet_address: string | null;
  is_active: boolean;
  created_at: string;
};

export default function UsersManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    role: "",
    email: "",
    is_active: true,
  });

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("role");
    
    if (!token || role !== "admin") {
      router.push("/login");
      return;
    }
    
    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      
      let url = `${API_URL}/api/v1/admin/users?limit=1000`;
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (roleFilter !== "all") {
        url += `&role=${roleFilter}`;
      }
      if (activeFilter !== "all") {
        url += `&is_active=${activeFilter === "active"}`;
      }
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        throw new Error("Không thể tải danh sách users");
      }
      
      const data = await res.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải danh sách users");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      email: user.email || "",
      is_active: user.is_active,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    try {
      const token = localStorage.getItem("access_token");
      const payload: any = {};
      
      if (editForm.role !== editingUser.role) {
        payload.role = editForm.role;
      }
      if (editForm.email !== (editingUser.email || "")) {
        payload.email = editForm.email || null;
      }
      if (editForm.is_active !== editingUser.is_active) {
        payload.is_active = editForm.is_active;
      }
      
      if (Object.keys(payload).length === 0) {
        setEditingUser(null);
        return;
      }
      
      const res = await fetch(`${API_URL}/api/v1/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Không thể cập nhật user");
      }
      
      setEditingUser(null);
      fetchUsers();
      alert("Cập nhật user thành công!");
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (!confirm(`Bạn có chắc muốn ${user.is_active ? "ban" : "unban"} user "${user.username}"?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/v1/admin/users/${user.id}/toggle-active`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Không thể thay đổi trạng thái user");
      }
      
      fetchUsers();
      alert(`User đã được ${user.is_active ? "ban" : "unban"} thành công!`);
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Bạn có chắc muốn xóa user "${user.username}"? (Soft delete - set is_active=false)`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Không thể xóa user");
      }
      
      fetchUsers();
      alert("Xóa user thành công!");
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Quản lý Users</h1>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">👥 Quản lý Users</h1>
          <button
            onClick={() => router.push("/reliefadmin")}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            ← Về Dashboard
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tìm kiếm</label>
              <input
                type="text"
                placeholder="Username hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                onKeyPress={(e) => {
                  if (e.key === "Enter") fetchUsers();
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="all">Tất cả</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Trạng thái</label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="all">Tất cả</option>
                <option value="active">Active</option>
                <option value="inactive">Banned</option>
              </select>
            </div>
          </div>
          <button
            onClick={fetchUsers}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔍 Tìm kiếm
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày tạo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Không có users nào
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={!user.is_active ? "bg-gray-100" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {user.role === "admin" ? "👑 Admin" : "👤 User"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {user.wallet_address ? (
                        <span className="text-xs font-mono">
                          {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {user.is_active ? "✅ Active" : "🚫 Banned"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-2 py-1 rounded text-xs ${
                            user.is_active
                              ? "bg-orange-500 text-white hover:bg-orange-600"
                              : "bg-green-500 text-white hover:bg-green-600"
                          }`}
                        >
                          {user.is_active ? "🚫 Ban" : "✅ Unban"}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Sửa User: {editingUser.username}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Email (optional)"
                  />
                </div>
                
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Active (không bị ban)</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  💾 Lưu
                </button>
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




