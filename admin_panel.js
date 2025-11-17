import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  MessageSquare,
  Settings as SettingsIcon,
  Menu,
  User,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  Users,
  Clock,
  RefreshCw,
  Radio,
  HeartPulse,
  RotateCcw,
  Trash2,
  Download,
  PlusCircle,
  QrCode,
  Bug,
  Save,
  FileText,
  Calendar,
  Shield,
  Info,
  Send,
  Loader,
  Search,
  MoreVertical,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  UserPlus,
  AlertTriangle,
  Database,
  Server,
  Eye,
  X,
  Filter,
  BarChart3,
  TrendingUp
} from 'lucide-react';

// Initial data for demonstration. In a real app this would be fetched from an API.
const initialData = {
  profile: {
    name: 'Alex Rivera',
    handle: '@alex',
    email: 'alex@example.com',
    deviceId: 'iPhone-A8F2',
    role: 'admin'
  },
  users: [
    {
      id: 1,
      name: 'Alex Rivera',
      handle: '@alex',
      email: 'alex@example.com',
      role: 'admin',
      status: 'online',
      lastSeen: 'Now',
      joined: '2024-01-15',
      devices: 2,
      aiUsage: 342,
      storageUsed: 5.2
    },
    {
      id: 2,
      name: 'Sofia Martinez',
      handle: '@sofia',
      email: 'sofia@example.com',
      role: 'user',
      status: 'online',
      lastSeen: '2h ago',
      joined: '2024-03-20',
      devices: 1,
      aiUsage: 156,
      storageUsed: 2.1
    },
    {
      id: 3,
      name: 'Marcus Chen',
      handle: '@marcus',
      email: 'marcus@example.com',
      role: 'user',
      status: 'offline',
      lastSeen: '3d ago',
      joined: '2024-02-10',
      devices: 3,
      aiUsage: 89,
      storageUsed: 8.7
    },
    {
      id: 4,
      name: 'Emily Johnson',
      handle: '@emily',
      email: 'emily@example.com',
      role: 'moderator',
      status: 'online',
      lastSeen: '15m ago',
      joined: '2024-01-28',
      devices: 2,
      aiUsage: 234,
      storageUsed: 3.4
    },
    {
      id: 5,
      name: 'David Kim',
      handle: '@david',
      email: 'david@example.com',
      role: 'user',
      status: 'suspended',
      lastSeen: '1w ago',
      joined: '2024-04-05',
      devices: 1,
      aiUsage: 12,
      storageUsed: 0.3
    },
    {
      id: 6,
      name: 'Rachel Green',
      handle: '@rachel',
      email: 'rachel@example.com',
      role: 'user',
      status: 'offline',
      lastSeen: '1d ago',
      joined: '2024-05-12',
      devices: 2,
      aiUsage: 198,
      storageUsed: 4.6
    }
  ],
  systemSettings: {
    allowRegistration: true,
    requireEmailVerification: true,
    aiRateLimit: 100,
    storagePerUser: 50,
    maxDevicesPerUser: 5,
    sessionTimeout: 30,
    enableBackups: true,
    backupFrequency: 'daily',
    maintenanceMode: false,
    debugMode: false
  },
  invites: [
    { id: 1, code: 'INV-2024-A8F2', createdBy: '@alex', uses: 3, maxUses: 5, expiresAt: '2025-11-01', status: 'active' },
    { id: 2, code: 'INV-2024-B3D9', createdBy: '@emily', uses: 5, maxUses: 5, expiresAt: '2025-10-25', status: 'expired' },
    { id: 3, code: 'INV-2024-C7E4', createdBy: '@alex', uses: 0, maxUses: 10, expiresAt: '2025-12-01', status: 'active' }
  ],
  logs: [
    { id: 1, timestamp: '2025-10-21 09:32:15', user: '@alex', action: 'User login', ip: '192.168.1.100', status: 'success' },
    { id: 2, timestamp: '2025-10-21 09:15:42', user: '@sofia', action: 'AI request', ip: '192.168.1.101', status: 'success' },
    { id: 3, timestamp: '2025-10-21 08:45:23', user: '@emily', action: 'User login', ip: '192.168.1.102', status: 'success' },
    { id: 4, timestamp: '2025-10-21 08:12:09', user: '@david', action: 'Failed login attempt', ip: '192.168.1.103', status: 'failed' },
    { id: 5, timestamp: '2025-10-21 07:30:44', user: 'system', action: 'Backup completed', ip: 'localhost', status: 'success' }
  ]
};

const App = () => {
  const [data, setData] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [systemSettings, setSystemSettings] = useState(initialData.systemSettings);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { from: 'user', text: 'Hello, AI!', time: '9:00' },
    { from: 'ai', text: 'Hi there! How can I help today?', time: '9:00' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatEngine, setChatEngine] = useState('openai');
  // AI settings state
  const [aiSettings, setAiSettings] = useState({
    openai_key: '',
    openai_model: '',
    ollama_url: '',
    ollama_model: '',
    remote_url: '',
    system_instructions: ''
  });
  const [openaiModels, setOpenaiModels] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);

  // Tailscale settings state
  const [tailscaleSettings, setTailscaleSettings] = useState({
    tailscale_ip: '',
    peers: []
  });

  // Filter users based on search, status and role
  const filteredUsers = data.users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Stats for overview
  const stats = {
    totalUsers: data.users.length,
    activeUsers: data.users.filter(u => u.status === 'online').length,
    suspendedUsers: data.users.filter(u => u.status === 'suspended').length,
    totalAIUsage: data.users.reduce((sum, u) => sum + u.aiUsage, 0),
    totalStorage: data.users.reduce((sum, u) => sum + u.storageUsed, 0),
    admins: data.users.filter(u => u.role === 'admin').length
  };

  // Handle user actions (delete, suspend, activate)
  const handleUserAction = (action, user) => {
    if (action === 'delete') {
      if (window.confirm(`Delete ${user.name}?`)) {
        setData(prev => ({
          ...prev,
          users: prev.users.filter(u => u.id !== user.id)
        }));
      }
    } else if (action === 'suspend') {
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => (u.id === user.id ? { ...u, status: 'suspended' } : u))
      }));
    } else if (action === 'activate') {
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => (u.id === user.id ? { ...u, status: 'online' } : u))
      }));
    }
  };

  // Create a new invite
  const handleCreateInvite = () => {
    const newInvite = {
      id: data.invites.length + 1,
      code: `INV-2024-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      createdBy: data.profile.handle,
      uses: 0,
      maxUses: 5,
      expiresAt: '2025-12-31',
      status: 'active'
    };
    setData(prev => ({
      ...prev,
      invites: [...prev.invites, newInvite]
    }));
    alert(`Invite created: ${newInvite.code}`);
  };

  // Send a chat message to the AI
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    const newMessage = {
      from: 'user',
      text: chatInput,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
    const url = chatEngine === 'openai' ? '/api/openai' : '/api/ollama';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage.text })
    })
      .then(resp => resp.json())
      .then(data => {
        const reply = data.reply || 'No response';
        const aiMsg = {
          from: 'ai',
          text: reply,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, aiMsg]);
      })
      .catch(() => {
        const errMsg = {
          from: 'ai',
          text: 'Error contacting AI',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, errMsg]);
      });
  }, [chatInput, chatEngine]);

  // Handle Enter key in chat input
  const handleChatKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Fetch AI settings and model lists when AI section becomes active
  useEffect(() => {
    if (activeSection === 'ai') {
      // Load current AI settings
      fetch('/api/settings')
        .then(resp => resp.json())
        .then(settings => {
          setAiSettings({
            openai_key: settings.openai_key || '',
            openai_model: settings.openai_model || '',
            ollama_url: settings.ollama_url || '',
            ollama_model: settings.ollama_model || '',
            remote_url: settings.remote_url || '',
            system_instructions: settings.system_instructions || ''
          });
        })
        .catch(() => {
          // ignore errors
        });
      // Load OpenAI models
      fetch('/api/models/openai')
        .then(resp => resp.json())
        .then(data => {
          if (data && data.data) {
            setOpenaiModels(data.data.map(m => m.id));
          }
        })
        .catch(() => {
          setOpenaiModels([]);
        });
      // Load Ollama models
      fetch('/api/models/ollama')
        .then(resp => resp.json())
        .then(data => {
          if (data && data.models) {
            setOllamaModels(data.models.map(m => m.name));
          }
        })
        .catch(() => {
          setOllamaModels([]);
        });
    }
  }, [activeSection]);

  // Save AI settings to backend
  const saveAiSettings = () => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiSettings)
    })
      .then(resp => {
        if (resp.ok) {
          alert('AI settings saved');
        } else {
          alert('Failed to save AI settings');
        }
      })
      .catch(() => {
        alert('Error saving AI settings');
      });
  };

  // Fetch Tailscale settings and peers when Tailscale tab is active
  useEffect(() => {
    if (activeSection === 'tailscale') {
      // Load current tailscale IP
      fetch('/api/tailscale')
        .then(resp => resp.json())
        .then(data => {
          setTailscaleSettings(prev => ({ ...prev, tailscale_ip: data.tailscale_ip || '' }));
        })
        .catch(() => {
          // ignore errors
        });
      // Load peers
      fetch('/api/tailscale/peers')
        .then(resp => resp.json())
        .then(data => {
          setTailscaleSettings(prev => ({ ...prev, peers: data.peers || [] }));
        })
        .catch(() => {
          setTailscaleSettings(prev => ({ ...prev, peers: [] }));
        });
    }
  }, [activeSection]);

  // Save Tailscale settings
  const saveTailscaleSettings = () => {
    fetch('/api/tailscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tailscaleSettings)
    })
      .then(resp => {
        if (resp.ok) {
          alert('Tailscale settings saved');
        } else {
          alert('Failed to save Tailscale settings');
        }
      })
      .catch(() => {
        alert('Error saving Tailscale settings');
      });
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg">
              <Shield size={24} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-200">Admin Panel</h1>
              <p className="text-xs text-gray-500">Full system control</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 px-3 py-1 bg-gray-800 rounded-full">
              {data.users.length} users
            </span>
            <span className="text-xs text-green-500 px-3 py-1 bg-green-900/20 rounded-full">
              {stats.activeUsers} online
            </span>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {['overview', 'users', 'invites', 'settings', 'system', 'logs', 'chat', 'ai', 'tailscale'].map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeSection === section
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                }`}
            >
              {section === 'ai'
                ? 'AI Settings'
                : section === 'tailscale'
                  ? 'Tailscale'
                  : section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview */}
        {activeSection === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-4 border border-blue-700/30">
                <Users size={20} className="text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                <p className="text-xs text-blue-300">Total Users</p>
              </div>
              <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-lg p-4 border border-green-700/30">
                <Activity size={20} className="text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
                <p className="text-xs text-green-300">Online Now</p>
              </div>
              <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-lg p-4 border border-purple-700/30">
                <Cpu size={20} className="text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.totalAIUsage}</p>
                <p className="text-xs text-purple-300">AI Requests</p>
              </div>
              <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-lg p-4 border border-orange-700/30">
                <HardDrive size={20} className="text-orange-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.totalStorage.toFixed(1)} GB</p>
                <p className="text-xs text-orange-300">Storage Used</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowUserModal(true)} className="p-3 bg-gray-700 hover:bg-gray-650 rounded-lg flex items-center gap-2">
                  <UserPlus size={16} className="text-blue-400" />
                  <span className="text-sm text-gray-200">Add User</span>
                </button>
                <button onClick={handleCreateInvite} className="p-3 bg-gray-700 hover:bg-gray-650 rounded-lg flex items-center gap-2">
                  <PlusCircle size={16} className="text-green-400" />
                  <span className="text-sm text-gray-200">Create Invite</span>
                </button>
                <button className="p-3 bg-gray-700 hover:bg-gray-650 rounded-lg flex items-center gap-2">
                  <Save size={16} className="text-purple-400" />
                  <span className="text-sm text-gray-200">Backup Now</span>
                </button>
                <button onClick={() => setActiveSection('settings')} className="p-3 bg-gray-700 hover:bg-gray-650 rounded-lg flex items-center gap-2">
                  <SettingsIcon size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-200">Settings</span>
                </button>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Clock size={16} className="text-blue-400" />
                Recent Activity
              </h3>
              <div className="space-y-2">
                {data.logs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-2 hover:bg-gray-750 rounded">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${log.status === 'success' ? 'bg-green-400' : log.status === 'failed' ? 'bg-red-400' : 'bg-blue-400'
                      }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300">{log.action}</p>
                      <p className="text-xs text-gray-500">{log.user} · {log.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {activeSection === 'users' && (
          <div className="p-4">
            <div className="mb-4 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full bg-gray-800 text-gray-200 rounded-lg pl-10 pr-4 py-3 text-sm border border-gray-700 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-lg border ${showFilters ? 'bg-purple-900/30 border-purple-700' : 'bg-gray-800 border-gray-700'
                    }`}
                >
                  <Filter size={18} className={showFilters ? 'text-purple-400' : 'text-gray-400'} />
                </button>
              </div>
              {showFilters && (
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="flex-1 bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600"
                  >
                    <option value="all">All Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="flex-1 bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="user">User</option>
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-xl font-bold text-green-400">{stats.activeUsers}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-500">Suspended</p>
                <p className="text-xl font-bold text-red-400">{stats.suspendedUsers}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-500">Admins</p>
                <p className="text-xl font-bold text-purple-400">{stats.admins}</p>
              </div>
            </div>
            <div className="space-y-2">
              {filteredUsers.map(user => (
                <div key={user.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold relative ${user.status === 'online'
                        ? 'bg-green-900/30 text-green-400'
                        : user.status === 'suspended'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-gray-700 text-gray-400'
                        }`}>
                        {user.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')}
                        {user.status === 'online' && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-200">{user.name}</h3>
                          {user.role === 'admin' && (
                            <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 text-xs rounded-full">Admin</span>
                          )}
                          {user.role === 'moderator' && (
                            <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded-full">Mod</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                          {user.handle} · {user.email}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                          <span>{user.lastSeen}</span>
                          <span>{user.devices} devices</span>
                          <span>{user.aiUsage} AI requests</span>
                          <span>{user.storageUsed} GB</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserModal(true);
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg"
                      >
                        <Edit size={16} className="text-blue-400" />
                      </button>
                      {user.status !== 'suspended' ? (
                        <button onClick={() => handleUserAction('suspend', user)} className="p-2 hover:bg-red-900/20 rounded-lg">
                          <Ban size={16} className="text-red-400" />
                        </button>
                      ) : (
                        <button onClick={() => handleUserAction('activate', user)} className="p-2 hover:bg-green-900/20 rounded-lg">
                          <CheckCircle size={16} className="text-green-400" />
                        </button>
                      )}
                      <button onClick={() => handleUserAction('delete', user)} className="p-2 hover:bg-red-900/20 rounded-lg">
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setSelectedUser(null);
                setShowUserModal(true);
              }}
              className="w-full mt-4 p-4 bg-purple-900/30 hover:bg-purple-900/40 border border-purple-700/50 rounded-lg text-purple-400 font-medium flex items-center justify-center gap-2"
            >
              <UserPlus size={20} />
              Add New User
            </button>
          </div>
        )}

        {/* Invites */}
        {activeSection === 'invites' && (
          <div className="p-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Active Invites</h3>
              <div className="space-y-2">
                {data.invites
                  .filter(i => i.status === 'active')
                  .map(invite => (
                    <div key={invite.id} className="bg-gray-750 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm text-blue-400 font-semibold">{invite.code}</p>
                        <p className="text-xs text-gray-500">
                          {invite.uses}/{invite.maxUses} uses · {invite.createdBy}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-gray-700 rounded-lg">
                          <QrCode size={16} className="text-gray-400" />
                        </button>
                        <button className="p-2 hover:bg-red-900/20 rounded-lg">
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <button
              onClick={handleCreateInvite}
              className="w-full p-4 bg-green-900/30 hover:bg-green-900/40 border border-green-700/50 rounded-lg text-green-400 font-medium flex items-center justify-center gap-2"
            >
              <PlusCircle size={20} />
              Create New Invite
            </button>
          </div>
        )}

        {/* System settings */}
        {activeSection === 'settings' && (
          <div className="p-4 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-200">Allow Registrations</span>
                <input
                  type="checkbox"
                  checked={systemSettings.allowRegistration}
                  onChange={e => setSystemSettings({ ...systemSettings, allowRegistration: e.target.checked })}
                  className="w-12 h-6"
                />
              </label>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <label className="text-sm text-gray-200 block mb-2">AI Rate Limit: {systemSettings.aiRateLimit}</label>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={systemSettings.aiRateLimit}
                onChange={e => setSystemSettings({ ...systemSettings, aiRateLimit: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <label className="text-sm text-gray-200 block mb-2">
                Storage Per User: {systemSettings.storagePerUser} GB
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={systemSettings.storagePerUser}
                onChange={e => setSystemSettings({ ...systemSettings, storagePerUser: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <button
              onClick={() => alert('System settings saved!')}
              className="w-full p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium"
            >
              Save Settings
            </button>
          </div>
        )}

        {/* System status */}
        {activeSection === 'system' && (
          <div className="p-4 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Server Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Uptime</span>
                  <span className="text-green-400">15d 7h 23m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CPU Usage</span>
                  <span className="text-green-400">23%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Memory</span>
                  <span className="text-green-400">4.2GB / 16GB</span>
                </div>
              </div>
            </div>
            <button className="w-full p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg text-blue-400 font-medium">
              Restart Services
            </button>
            <button className="w-full p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 font-medium">
              Emergency Shutdown
            </button>
          </div>
        )}

        {/* Logs */}
        {activeSection === 'logs' && (
          <div className="p-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-3 bg-gray-750 border-b border-gray-700 flex justify-between">
                <h3 className="text-sm font-semibold text-gray-300">System Logs</h3>
                <button className="text-xs text-blue-400">Export</button>
              </div>
              <div className="divide-y divide-gray-700">
                {data.logs.map(log => (
                  <div key={log.id} className="p-3 hover:bg-gray-750">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${log.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                      <div className="flex-1">
                        <p className="text-sm text-gray-300">{log.action}</p>
                        <p className="text-xs text-gray-500">
                          {log.user} · {log.timestamp}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tailscale Configuration */}
        {activeSection === 'tailscale' && (
          <div className="p-4 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Home Hub IP</h3>
              <input
                type="text"
                value={tailscaleSettings.tailscale_ip}
                onChange={e => setTailscaleSettings({ ...tailscaleSettings, tailscale_ip: e.target.value })}
                placeholder="e.g. 100.xx.xx.xx"
                className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Tailscale Peers</h3>
              {tailscaleSettings.peers && tailscaleSettings.peers.length > 0 ? (
                <ul className="space-y-1 text-sm text-gray-300">
                  {tailscaleSettings.peers.map((peer, idx) => (
                    <li key={idx}>{peer}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No peers available</p>
              )}
            </div>
            <button
              onClick={saveTailscaleSettings}
              className="w-full p-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
            >
              Save Tailscale Settings
            </button>
          </div>
        )}

        {/* Chat interface */}
        {activeSection === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2" title="CPU Status">
                  <Cpu size={16} className="text-green-400" aria-hidden="true" />
                  <span className="text-xs text-green-400">●</span>
                </div>
                <div className="flex items-center gap-2" title="Network Status">
                  <Wifi size={16} className="text-green-400" aria-hidden="true" />
                  <span className="text-xs text-green-400">●</span>
                </div>
                <span className="text-sm font-medium text-gray-300">AI Chat</span>
              </div>
              <button onClick={() => setChatEngine(chatEngine === 'openai' ? 'ollama' : 'openai')} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200">
                {chatEngine === 'openai' ? 'Use Ollama' : 'Use OpenAI'}
              </button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 ${msg.from === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'
                      }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Input */}
            <div className="bg-gray-900 border-t border-gray-800 p-4">
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleChatKey}
                  placeholder="Message AI assistant..."
                  rows={2}
                  className="flex-1 bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg font-medium flex items-center gap-2 disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI / API Settings */}
        {activeSection === 'ai' && (
          <div className="p-4 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">OpenAI Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-200 block mb-1">API Key</label>
                  <input
                    type="text"
                    value={aiSettings.openai_key}
                    onChange={e => setAiSettings({ ...aiSettings, openai_key: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-200 block mb-1">Model</label>
                  <select
                    value={aiSettings.openai_model}
                    onChange={e => setAiSettings({ ...aiSettings, openai_model: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600"
                  >
                    <option value="">Select a model</option>
                    {openaiModels.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Ollama Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-200 block mb-1">Ollama URL</label>
                  <input
                    type="text"
                    value={aiSettings.ollama_url}
                    onChange={e => setAiSettings({ ...aiSettings, ollama_url: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-200 block mb-1">Model</label>
                  <select
                    value={aiSettings.ollama_model}
                    onChange={e => setAiSettings({ ...aiSettings, ollama_model: e.target.value })}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600"
                  >
                    <option value="">Select a model</option>
                    {ollamaModels.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Remote URL</h3>
              <input
                type="text"
                value={aiSettings.remote_url}
                onChange={e => setAiSettings({ ...aiSettings, remote_url: e.target.value })}
                className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
              />
              {aiSettings.remote_url && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-2">Scan this QR with your device:</p>
                  <img
                    src={`https://chart.googleapis.com/chart?cht=qr&chs=180x180&chl=${encodeURIComponent(
                      aiSettings.remote_url
                    )}`}
                    alt="Remote URL QR"
                    className="w-32 h-32"
                  />
                </div>
              )}
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">System Instructions</h3>
              <textarea
                value={aiSettings.system_instructions}
                onChange={e => setAiSettings({ ...aiSettings, system_instructions: e.target.value })}
                rows={5}
                className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <button onClick={saveAiSettings} className="w-full p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium">
              Save AI Settings
            </button>
          </div>
        )}

        {/* User modal */}
        {showUserModal && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
            onClick={() => setShowUserModal(false)}
          >
            <div
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                  {selectedUser ? <Edit size={20} /> : <UserPlus size={20} />}
                  {selectedUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button onClick={() => setShowUserModal(false)} className="p-1 hover:bg-gray-700 rounded">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1.5">Full Name</label>
                  <input
                    type="text"
                    defaultValue={selectedUser?.name}
                    placeholder="John Doe"
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1.5">Handle</label>
                  <input
                    type="text"
                    defaultValue={selectedUser?.handle}
                    placeholder="@johndoe"
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1.5">Email</label>
                  <input
                    type="email"
                    defaultValue={selectedUser?.email}
                    placeholder="john@example.com"
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1.5">Role</label>
                  <select
                    defaultValue={selectedUser?.role || 'user'}
                    className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {!selectedUser && (
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-1.5">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-gray-700 text-gray-200 rounded-lg px-3 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 p-3 bg-gray-700 hover:bg-gray-650 rounded-lg text-gray-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      alert(selectedUser ? 'User updated!' : 'User created!');
                      setShowUserModal(false);
                    }}
                    className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium"
                  >
                    {selectedUser ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;