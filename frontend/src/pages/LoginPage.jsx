import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, Key } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  if (user) {
    const from = location.state?.from?.pathname || (user.role === "admin" ? "/dashboard" : "/my-brands");
    navigate(from, { replace: true });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Trim все поля перед отправкой
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedSecretCode = secretCode.trim().toUpperCase();
    
    // Валидация
    if (!trimmedEmail || !trimmedPassword || !trimmedSecretCode) {
      toast.error("Заполните все поля");
      return;
    }
    
    setLoading(true);

    try {
      const userData = await login(trimmedEmail, trimmedPassword, trimmedSecretCode);
      toast.success(`Добро пожаловать, ${userData.nickname}!`);
      
      const from = location.state?.from?.pathname || (userData.role === "admin" || userData.role === "super_admin" ? "/dashboard" : "/my-brands");
      navigate(from, { replace: true });
    } catch (error) {
      const message = error.response?.data?.detail || "Ошибка входа";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85)), url('https://images.unsplash.com/photo-1647735282241-edad5f6439e4?crop=entropy&cs=srgb&fm=jpg&q=85')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-mono font-bold text-4xl tracking-tighter text-[#FF9900]" data-testid="login-logo">
            PROCTO_13
          </h1>
          <p className="text-[#94A3B8] mt-2 uppercase tracking-widest text-sm">
            Brand Management System
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[#13161B] border border-[#2A2F3A] rounded-[2px] p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-[#E6E6E6] mb-6 text-center">
            Вход в систему
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px] text-[#E6E6E6] placeholder-[#475569] focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none transition-all"
                  placeholder="email@example.com"
                  required
                  data-testid="email-input"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px] text-[#E6E6E6] placeholder-[#475569] focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none transition-all"
                  placeholder="••••••••"
                  required
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94A3B8] transition-colors"
                  data-testid="toggle-password"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Secret Code */}
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                Секретный код
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" size={18} />
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="w-full pl-10 pr-4 py-3 bg-[#0F1115] border border-[#2A2F3A] rounded-[2px] text-[#E6E6E6] placeholder-[#475569] focus:border-[#FF9900] focus:ring-1 focus:ring-[#FF9900] outline-none transition-all font-mono tracking-wider uppercase"
                  placeholder="XXXXXXXX"
                  required
                  autoComplete="off"
                  data-testid="secret-code-input"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#FF9900] text-black font-bold uppercase tracking-wider rounded-[2px] hover:bg-[#FFAD33] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(255,153,0,0.3)]"
              data-testid="login-submit"
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[#475569] text-sm mt-6">
          © 2024 PROCTO 13 LLC. Все права защищены.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
