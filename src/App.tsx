/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, User, Trophy, MessageSquare, Settings, LogOut, Volume2, 
  CheckCircle, XCircle, BrainCircuit, Star, Zap, Flame,
  BookOpen, Stethoscope, Briefcase, Cpu, Wrench, Sprout, Building,
  Languages, ChevronRight, Send, ArrowLeft, RefreshCw, Bell,
  Award, Heart, Target, Clock, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { generateQuizQuestion, getTutorResponse, translateQuizQuestion, generateSpeech } from './services/geminiService';

// --- UTILITIES ---
const playSound = (type: 'correct' | 'wrong' | 'levelup' | 'achievement') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'correct') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'levelup') {
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'achievement') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    }
  } catch (e) { /* Ignore audio errors */ }
};

// --- DATA: CATEGORIES ---
const CATEGORY_GROUPS = [
  { id: 'sci_math', name: 'Science & Maths', icon: <BookOpen className="w-6 h-6"/>, topics: ['Physics', 'Chemistry', 'Maths', 'Biology', 'Data Science'] },
  { id: 'tech_eng', name: 'Tech & Engineering', icon: <Cpu className="w-6 h-6"/>, topics: ['Engineering', 'Architecture', 'Programming', 'Software Engineer', 'Web Developer', 'AI', 'Hacker (ethical)'] },
  { id: 'medical', name: 'Health & Medical', icon: <Stethoscope className="w-6 h-6"/>, topics: ['Doctor', 'Pharmacy', 'Nursing', 'Biotech', 'Lab Technician', 'Radiology', 'Physiotherapy', 'Hospital jobs'] },
  { id: 'business', name: 'Commerce & Law', icon: <Briefcase className="w-6 h-6"/>, topics: ['Accountancy', 'Business', 'Economics', 'CA', 'CS', 'B.Com', 'MBA', 'Banking', 'Lawyer'] },
  { id: 'humanities', name: 'Humanities & Govt', icon: <Building className="w-6 h-6"/>, topics: ['History', 'Geography', 'Political Science', 'UPSC', 'NDA', 'Teacher', 'Journalist'] },
  { id: 'vocational', name: 'Vocational & Trades', icon: <Wrench className="w-6 h-6"/>, topics: ['Engineering diploma', 'Junior Engineer', 'Electrician', 'Fitter', 'Mechanic', 'Skilled jobs'] },
  { id: 'agriculture', name: 'Agriculture', icon: <Sprout className="w-6 h-6"/>, topics: ['Farming science', 'Agriculture tech', 'Agriculture officer', 'Scientist'] },
  { id: 'lifestyle', name: 'Lifestyle & Arts', icon: <Star className="w-6 h-6"/>, topics: ['Fashion', 'Hotel management', 'Beauty', 'Animation'] }
];

// --- MAIN APP COMPONENT ---
export default function App() {
  const [view, setView] = useState('login'); 
  const [user, setUser] = useState<any>(null);
  const [language, setLanguage] = useState('en');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [gameMode, setGameMode] = useState<'quiz' | 'study'>('quiz');
  const [difficulty, setDifficulty] = useState<'easy' | 'hard' | 'advance'>('easy');
  const [quizTimer, setQuizTimer] = useState(30);
  const [speechVoice, setSpeechVoice] = useState<'male' | 'female'>('female');
  const [speechRate, setSpeechRate] = useState(1.0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [userStats, setUserStats] = useState<any>({
    topics: {},
    difficulties: { easy: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 }, advance: { correct: 0, total: 0 } },
    masteryBadges: []
  });
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);
  
  // Game State
  const [coins, setCoins] = useState(100);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);

  const ACHIEVEMENTS = [
    { id: 'first_quiz', title: 'Early Bird', desc: 'Complete your first quiz', icon: <Zap className="w-5 h-5 text-yellow-400" /> },
    { id: 'streak_3', title: 'Streak Starter', desc: 'Reach a 3-question streak', icon: <Flame className="w-5 h-5 text-orange-500" /> },
    { id: 'coin_500', title: 'Wealthy Scholar', desc: 'Accumulate 500 coins', icon: <Zap className="w-5 h-5 text-amber-400" /> },
    { id: 'level_5', title: 'Rising Star', desc: 'Reach Level 5', icon: <Star className="w-5 h-5 text-indigo-400" /> },
    { id: 'study_mode', title: 'Deep Learner', desc: 'Complete a study session', icon: <BookOpen className="w-5 h-5 text-emerald-400" /> },
    { id: 'translator', title: 'Global Mind', desc: 'Use the translation feature', icon: <Languages className="w-5 h-5 text-blue-400" /> }
  ];

  const unlockAchievement = useCallback((id: string) => {
    setUnlockedAchievements(prev => {
      if (prev.includes(id)) return prev;
      
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      if (achievement) {
        // Use a timeout to avoid updating state during render or effect cycle of same component
        setTimeout(() => {
          showToast(`🏆 Achievement Unlocked: ${achievement.title}!`, 'success');
          setCoins(c => c + 100);
        }, 0);
      }
      return [...prev, id];
    });
  }, [unlockedAchievements, ACHIEVEMENTS]);

  useEffect(() => {
    if (coins >= 500) unlockAchievement('coin_500');
    if (level >= 5) unlockAchievement('level_5');
  }, [coins, level, unlockAchievement]);

  const showToast = (message: string, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogin = (platform: string) => {
    setUser({
      name: `Sangharsh Raj`,
      platform: platform,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random()}`
    });
    setView('home');
    showToast(`Welcome! Logged in via ${platform}`, 'success');
  };

  const addXp = (amount: number) => {
    setXp(prev => {
      const newXp = prev + amount;
      const nextLevelXp = level * 100;
      
      if (newXp >= nextLevelXp) {
        // Schedule these updates for after the current render cycle
        setTimeout(() => {
          setLevel(l => l + 1);
          setCoins(c => c + 50);
          playSound('levelup');
          showToast(`🎉 Level Up! You are now Level ${level + 1}. +50 Coins!`, 'success');
        }, 0);
        return newXp - nextLevelXp;
      }
      return newXp;
    });
  };

  const recordAnswer = (topic: string, diff: string, isCorrect: boolean) => {
    setUserStats((prev: any) => {
      const newStats = { ...prev };
      
      // Update topic stats
      if (!newStats.topics[topic]) {
        newStats.topics[topic] = { correct: 0, total: 0 };
      }
      newStats.topics[topic].total += 1;
      if (isCorrect) newStats.topics[topic].correct += 1;

      // Update difficulty stats
      if (!newStats.difficulties[diff]) {
        newStats.difficulties[diff] = { correct: 0, total: 0 };
      }
      newStats.difficulties[diff].total += 1;
      if (isCorrect) newStats.difficulties[diff].correct += 1;

      // Check for Mastery Badge
      const topicStats = newStats.topics[topic];
      const accuracy = (topicStats.correct / topicStats.total) * 100;
      const alreadyHasBadge = newStats.masteryBadges.includes(topic);

      if (topicStats.total >= 10 && accuracy >= 90 && !alreadyHasBadge) {
        newStats.masteryBadges.push(topic);
        setTimeout(() => {
          playSound('achievement');
          showToast(`🏆 Mastery Badge Unlocked: ${topic}!`, 'success');
          setCoins(c => c + 100);
        }, 0);
      }

      return newStats;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 relative overflow-x-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 z-50 pointer-events-none"
          >
            <div className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-2xl font-bold border ${
              toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500 text-emerald-100' : 
              'bg-indigo-900/90 border-indigo-500 text-indigo-100'
            }`}>
              <Bell className="w-4 h-4" /> {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'login' && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <LoginScreen onLogin={handleLogin} />
          </motion.div>
        )}
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <HomeScreen user={user} setView={setView} level={level} xp={xp} coins={coins} setSelectedTopic={setSelectedTopic} lang={language} setLang={setLanguage} gameMode={gameMode} setGameMode={setGameMode} />
          </motion.div>
        )}
        {view === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <QuizScreen 
              topic={selectedTopic} 
              lang={language} 
              setView={setView} 
              addXp={addXp} 
              setCoins={setCoins} 
              streak={streak} 
              setStreak={setStreak} 
              level={level} 
              gameMode={gameMode} 
              difficulty={difficulty} 
              unlockAchievement={unlockAchievement} 
              quizTimer={quizTimer} 
              recordAnswer={recordAnswer}
              speechSettings={{ voice: speechVoice, rate: speechRate }}
              ttsEnabled={ttsEnabled}
              showToast={showToast}
            />
          </motion.div>
        )}
        {view === 'chat' && (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <ChatScreen setView={setView} lang={language} selectedTopic={selectedTopic} />
          </motion.div>
        )}
        {view === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <LeaderboardScreen setView={setView} user={user} level={level} xp={xp} />
          </motion.div>
        )}
        {view === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
            <ProfileScreen 
              setView={setView} 
              user={user} 
              setUser={setUser} 
              level={level} 
              coins={coins} 
              xp={xp} 
              showToast={showToast} 
              unlockedAchievements={unlockedAchievements} 
              ACHIEVEMENTS={ACHIEVEMENTS} 
              gameMode={gameMode} 
              setGameMode={setGameMode} 
              difficulty={difficulty} 
              setDifficulty={setDifficulty} 
              quizTimer={quizTimer} 
              setQuizTimer={setQuizTimer} 
              userStats={userStats}
              speechVoice={speechVoice}
              setSpeechVoice={setSpeechVoice}
              speechRate={speechRate}
              setSpeechRate={setSpeechRate}
              ttsEnabled={ttsEnabled}
              setTtsEnabled={setTtsEnabled}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- LOGIN SCREEN ---
function LoginScreen({ onLogin }: { onLogin: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black p-6">
      <div className="text-center mb-12">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="inline-flex items-center justify-center p-4 bg-indigo-500/20 rounded-full mb-6 ring-4 ring-indigo-500/30"
        >
          <BrainCircuit className="w-16 h-16 text-indigo-400" />
        </motion.div>
        <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
          Sangharsh Raj
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Bilingual Trivia & Learning. Infinite questions powered by AI.
        </p>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm space-y-4 backdrop-blur-xl bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl"
      >
        <h2 className="text-xl font-semibold text-center mb-6">Choose Login Method</h2>
        
        <button onClick={() => onLogin('Google')} className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-3.5 px-4 rounded-xl font-bold hover:bg-slate-100 transition-all active:scale-95">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Continue with Google
        </button>

        <button onClick={() => onLogin('Facebook')} className="w-full flex items-center justify-center gap-3 bg-[#1877F2] text-white py-3.5 px-4 rounded-xl font-bold hover:bg-[#166fe5] transition-all active:scale-95">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Continue with Facebook
        </button>

        <button onClick={() => onLogin('X')} className="w-full flex items-center justify-center gap-3 bg-black text-white py-3.5 px-4 rounded-xl border border-slate-700 font-bold hover:bg-slate-900 transition-all active:scale-95">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 5.961h-1.91z"/></svg>
          Continue with X
        </button>
      </motion.div>
    </div>
  );
}

// --- HOME SCREEN ---
function HomeScreen({ user, setView, level, xp, coins, setSelectedTopic, lang, setLang, gameMode, setGameMode }: any) {
  const dailyChallengeTopic = "UPSC"; 

  const startQuiz = (topic: string) => {
    setSelectedTopic(topic);
    setView('quiz');
  };

  return (
    <div className="pb-24 max-w-4xl mx-auto min-h-screen relative">
      <div className="flex justify-between items-center p-6 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-800">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('profile')}>
          <img src={user?.avatar} alt="Avatar" className="w-12 h-12 rounded-full bg-slate-800 border-2 border-indigo-500" />
          <div>
            <h3 className="font-bold text-lg leading-tight">{user?.name}</h3>
            <div className="flex gap-2 text-xs font-medium mt-1">
              <span className="flex items-center text-amber-400"><Star className="w-3 h-3 mr-1"/> Lvl {level}</span>
              <span className="flex items-center text-yellow-500"><Zap className="w-3 h-3 mr-1"/> {coins}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-full transition-colors text-sm font-semibold border border-slate-700"
          >
            <Languages className="w-4 h-4 text-indigo-400" />
            {lang === 'en' ? 'ENG' : 'HIN'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 shadow-xl shadow-indigo-500/20 relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-20"><Flame className="w-32 h-32" /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-100 font-semibold mb-2 uppercase tracking-wider text-sm">
              <Flame className="w-4 h-4 text-orange-300" /> Daily Challenge (2x XP)
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-4">{dailyChallengeTopic} Mastery</h2>
            <button 
              onClick={() => startQuiz(dailyChallengeTopic)}
              className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-lg"
            >
              <Play className="w-5 h-5" fill="currentColor" /> Play Now
            </button>
          </div>
        </motion.div>

        <div>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400"/> Select Domain
          </h3>
          <div className="space-y-6">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.id} className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-lg font-semibold text-slate-200">
                  <div className="p-2 bg-slate-800 rounded-lg text-indigo-400">{group.icon}</div>
                  {group.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.topics.map(topic => (
                    <button 
                      key={topic} 
                      onClick={() => startQuiz(topic)}
                      className="bg-slate-800 hover:bg-indigo-600 hover:border-indigo-500 border border-slate-700 text-sm px-4 py-2 rounded-full transition-all active:scale-95 text-slate-300 hover:text-white"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around items-center max-w-4xl mx-auto z-20">
        <NavButton icon={<BrainCircuit/>} label="Play" active onClick={() => setView('home')} />
        <NavButton icon={<MessageSquare/>} label="AI Tutor" onClick={() => setView('chat')} />
        <NavButton icon={<Trophy/>} label="Rank" onClick={() => setView('leaderboard')} />
        <NavButton icon={<User/>} label="Profile" onClick={() => setView('profile')} />
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
      {React.cloneElement(icon, { className: 'w-6 h-6' })}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

// --- QUIZ ENGINE SCREEN ---
function QuizScreen({ topic, lang, setView, addXp, setCoins, streak, setStreak, level, gameMode, difficulty, unlockAchievement, quizTimer, recordAnswer, speechSettings, ttsEnabled, showToast }: any) {
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<any>(null);
  const [displayLang, setDisplayLang] = useState(lang);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(quizTimer);
  const [error, setError] = useState(false);
  const [cachedAudio, setCachedAudio] = useState<{ [key: string]: string | null }>({ all: null, explanation: null });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  
  const isMounted = useRef(true);

  const getFullQuestionText = useCallback((data: any, l: string, answered: boolean) => {
    if (!data) return "";
    const qPrefix = l === 'hi' ? 'सवाल: ' : 'Question: ';
    const oPrefix = l === 'hi' ? 'विकल्प हैं: ' : 'Options are: ';
    const aPrefix = l === 'hi' ? 'सही उत्तर है: ' : 'The correct answer is: ';
    const ePrefix = l === 'hi' ? 'व्याख्या: ' : 'Explanation: ';

    let text = `${qPrefix}${data.questionText}. `;
    text += `${oPrefix}${data.options.map((opt: string, i: number) => `${l === 'hi' ? 'विकल्प' : 'Option'} ${i + 1}: ${opt}`).join('. ')}. `;
    
    if (answered) {
      text += `${aPrefix}${data.options[data.correctIndex]}. `;
      text += `${ePrefix}${data.explanation}`;
    }
    return text;
  }, []);

  const prefetchAudio = async (text: string, key: string, l: string, retryCount = 0) => {
    if (!text || !text.trim() || gameMode !== 'study' || !ttsEnabled || quotaExceeded) return;
    
    // Add a small initial delay to avoid hitting rate limits immediately on load
    if (retryCount === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      const url = await generateSpeech(text, l, speechSettings);
      if (isMounted.current) {
        setCachedAudio(prev => ({ ...prev, [key]: url }));
        setQuotaExceeded(false); // Reset on success
      }
    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        if (retryCount < 2) {
          // Exponential backoff: 2s, 4s
          const delay = Math.pow(2, retryCount + 1) * 1000;
          setTimeout(() => prefetchAudio(text, key, l, retryCount + 1), delay);
        } else {
          console.warn("TTS Quota hit. Disabling pre-fetch temporarily.");
          setQuotaExceeded(true);
          // Reset quota status after 1 minute
          setTimeout(() => setQuotaExceeded(false), 60000);
        }
      } else {
        console.error(`Prefetch Error (${key}):`, err);
      }
    }
  };

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError(false);
    setIsAnswered(false);
    setSelectedOpt(null);
    setDisplayLang(lang);
    setCachedAudio({ all: null, explanation: null });
    
    try {
      const data = await generateQuizQuestion(topic, lang, level, gameMode, difficulty);
      if (isMounted.current) {
        setQuestionData(data);
        setTimeLeft(quizTimer);
        setLoading(false);
        // Prefetch "Read All" audio (without explanation)
        const text = getFullQuestionText(data, lang, false);
        prefetchAudio(text, 'all', lang);
      }
    } catch (err) {
      console.error("Quiz Error:", err);
      if (isMounted.current) {
        setLoading(false);
        setError(true);
      }
    }
  }, [topic, lang, level, gameMode, difficulty, quizTimer]);

  const handleTranslate = async () => {
    if (translating || loading) return;
    const targetLang = displayLang === 'en' ? 'hi' : 'en';
    setTranslating(true);
    setCachedAudio({ all: null, explanation: null });
    try {
      const translatedData = await translateQuizQuestion(questionData, targetLang);
      if (isMounted.current) {
        setQuestionData(translatedData);
        setDisplayLang(targetLang);
        unlockAchievement('translator');
        // Prefetch for new language
        const text = getFullQuestionText(translatedData, targetLang, isAnswered);
        prefetchAudio(text, 'all', targetLang);
        if (isAnswered) {
          prefetchAudio(translatedData.explanation, 'explanation', targetLang);
        }
      }
    } catch (err) {
      console.error("Translation Error:", err);
    } finally {
      if (isMounted.current) setTranslating(false);
    }
  };

  const handleSpeak = async (text: string, id: string) => {
    if (speaking) return;
    
    // Use cached explanation if available
    if (id === 'explanation' && cachedAudio.explanation) {
      setSpeaking(id);
      const audio = new Audio(cachedAudio.explanation);
      audio.onended = () => setSpeaking(null);
      audio.onerror = () => setSpeaking(null);
      audio.play();
      return;
    }

    setSpeaking(id);
    try {
      const audioUrl = await generateSpeech(text, displayLang, speechSettings);
      const audio = new Audio(audioUrl);
      audio.onended = () => setSpeaking(null);
      audio.onerror = () => setSpeaking(null);
      await audio.play();
    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        showToast("AI Voice is busy. Please try again in a minute.", "info");
        setQuotaExceeded(true);
        setTimeout(() => setQuotaExceeded(false), 60000);
      } else {
        console.error("Speech Error:", err);
      }
      setSpeaking(null);
    }
  };

  const handleSpeakAll = async () => {
    if (speaking || !questionData) return;
    
    // Use cached "all" audio if available
    if (cachedAudio.all) {
      setSpeaking('all');
      const audio = new Audio(cachedAudio.all);
      audio.onended = () => setSpeaking(null);
      audio.onerror = () => setSpeaking(null);
      audio.play();
      return;
    }

    const fullText = getFullQuestionText(questionData, displayLang, isAnswered);
    if (!fullText.trim()) return;

    setSpeaking('all');
    try {
      const audioUrl = await generateSpeech(fullText, displayLang, speechSettings);
      const audio = new Audio(audioUrl);
      audio.onended = () => setSpeaking(null);
      audio.onerror = () => setSpeaking(null);
      await audio.play();
    } catch (err: any) {
      const errorMsg = typeof err === 'string' ? err : JSON.stringify(err);
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        showToast("AI Voice is busy. Please try again in a minute.", "info");
        setQuotaExceeded(true);
        setTimeout(() => setQuotaExceeded(false), 60000);
      } else {
        console.error("Speech All Error:", err);
      }
      setSpeaking(null);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchQuestion();
    return () => { isMounted.current = false; };
  }, [fetchQuestion]);

  useEffect(() => {
    if (loading || isAnswered || error || gameMode === 'study') return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isAnswered, error, gameMode]);

  useEffect(() => {
    if (gameMode === 'quiz' && timeLeft === 0 && !isAnswered && !loading && !error) {
      handleTimeOut();
    }
  }, [timeLeft, isAnswered, loading, error, gameMode]);

  const handleTimeOut = () => {
    playSound('wrong');
    setIsAnswered(true);
    setSelectedOpt(-1); 
    setStreak(0);
    recordAnswer(topic, difficulty, false);
  };

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedOpt(index);

    const isCorrect = index === questionData.correctIndex;
    recordAnswer(topic, difficulty, isCorrect);

    // Prefetch explanation audio as soon as answered
    prefetchAudio(questionData.explanation, 'explanation', displayLang);
    // Also update "Read All" cache to include explanation if user wants to hear it again
    const updatedAllText = getFullQuestionText(questionData, displayLang, true);
    prefetchAudio(updatedAllText, 'all', displayLang);

    if (isCorrect) {
      playSound('correct');
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak >= 3) unlockAchievement('streak_3');
      unlockAchievement('first_quiz');
      if (gameMode === 'study') unlockAchievement('study_mode');
      
      // In study mode, give less XP but still rewarding
      addXp(gameMode === 'study' ? 10 : (15 + Math.floor(timeLeft / 2))); 
      setCoins((c: number) => c + (gameMode === 'study' ? 1 : 2));
    } else {
      playSound('wrong');
      setStreak(0);
    }
  };

  const handleNext = () => {
    fetchQuestion();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
        <p className="text-xl font-medium animate-pulse text-indigo-200">
          {gameMode === 'study' ? (lang === 'hi' ? 'Concept Taiyar Ho Raha Hai...' : 'Preparing Concept...') : (lang === 'hi' ? 'Tricky Sawal...' : 'Tricky Question...')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <XCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-bold">Oops! Something went wrong.</h2>
        <button onClick={fetchQuestion} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2">
          <RefreshCw className="w-5 h-5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 min-h-screen flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          {gameMode === 'study' && ttsEnabled && (
            <button 
              onClick={handleSpeakAll}
              disabled={!!speaking || loading || quotaExceeded}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                speaking === 'all' ? 'bg-indigo-600 text-white animate-pulse' : 
                quotaExceeded ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' :
                'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30'
              }`}
              title={quotaExceeded ? "AI Voice busy" : "Read full question and options"}
            >
              <Volume2 className={`w-4 h-4 ${speaking === 'all' ? 'animate-bounce' : ''}`} />
              {speaking === 'all' ? 'READING...' : quotaExceeded ? 'BUSY' : 'READ ALL'}
            </button>
          )}
          <button 
            onClick={handleTranslate}
            disabled={translating || loading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              translating ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30'
            }`}
          >
            <Languages className={`w-4 h-4 ${translating ? 'animate-spin' : ''}`} />
            {translating ? '...' : (displayLang === 'en' ? 'HINDI' : 'ENGLISH')}
          </button>
          <div className="flex items-center gap-1 text-orange-400 font-bold">
            <Flame className="w-5 h-5" /> {streak}
          </div>
          {gameMode === 'quiz' ? (
            <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-lg ${
              timeLeft < 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-indigo-500 text-indigo-400'
            }`}>
              {timeLeft}
            </div>
          ) : (
            <div className="bg-indigo-600/20 text-indigo-400 px-4 py-2 rounded-full text-xs font-bold border border-indigo-500/30">
              STUDY MODE
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-8">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative group">
          <h2 className="text-2xl font-bold leading-relaxed pr-8">
            {questionData.questionText}
          </h2>
        </div>

        <div className="grid gap-4">
          {questionData.options.map((option: string, idx: number) => {
            let state = 'default';
            if (isAnswered) {
              if (idx === questionData.correctIndex) state = 'correct';
              else if (idx === selectedOpt) state = 'wrong';
              else state = 'dimmed';
            }

            return (
              <div key={idx} className="relative group">
                <motion.button
                  disabled={isAnswered}
                  onClick={() => handleAnswer(idx)}
                  initial={false}
                  animate={state === 'correct' ? { scale: [1, 1.02, 1] } : state === 'wrong' ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`w-full p-5 rounded-2xl text-left font-semibold text-lg transition-all border-2 flex justify-between items-center pr-16 ${
                    state === 'default' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500 hover:bg-slate-800' :
                    state === 'correct' ? 'bg-emerald-900/40 border-emerald-500 text-emerald-100' :
                    state === 'wrong' ? 'bg-red-900/40 border-red-500 text-red-100' :
                    'bg-slate-900/50 border-slate-900 text-slate-500'
                  }`}
                >
                  {option}
                  <AnimatePresence>
                    {state === 'correct' && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0, rotate: -45 }} 
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      >
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      </motion.div>
                    )}
                    {state === 'wrong' && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0, rotate: 45 }} 
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      >
                        <XCircle className="w-6 h-6 text-red-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            );
          })}
        </div>

        {isAnswered && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-900/20 p-6 rounded-2xl border border-indigo-500/30 relative"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" /> Explanation
              </h4>
              {gameMode === 'study' && ttsEnabled && (
                <button 
                  onClick={() => handleSpeak(questionData.explanation, 'explanation')}
                  disabled={!!speaking || quotaExceeded}
                  className={`p-2 rounded-full transition-all ${
                    speaking === 'explanation' ? 'bg-indigo-600 text-white animate-pulse' : 
                    quotaExceeded ? 'bg-slate-800 text-slate-600 cursor-not-allowed' :
                    'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20'
                  }`}
                  title={quotaExceeded ? "AI Voice busy" : "Read explanation"}
                >
                  <Volume2 className={`w-4 h-4 ${speaking === 'explanation' ? 'animate-bounce' : ''}`} />
                </button>
              )}
            </div>
            <p className="text-slate-300 leading-relaxed">
              {questionData.explanation}
            </p>
          </motion.div>
        )}
      </div>

      <div className="mt-8">
        {isAnswered ? (
          <button 
            onClick={handleNext}
            className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
          >
            Next Question <ChevronRight className="w-6 h-6" />
          </button>
        ) : (
          <div className="text-center text-slate-500 text-sm font-medium">
            Select an answer to continue
          </div>
        )}
      </div>
    </div>
  );
}

// --- CHAT SCREEN (AI TUTOR) ---
function ChatScreen({ setView, lang, selectedTopic }: any) {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', text: lang === 'hi' ? `Namaste! Main Sangharsh Raj hoon. Aapko ${selectedTopic || 'kisi bhi topic'} mein kya madad chahiye?` : `Hello! I'm Sangharsh Raj. How can I help you with ${selectedTopic || 'any topic'} today?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await getTutorResponse(userMsg, lang, selectedTopic);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      <div className="p-6 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center gap-4">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <BrainCircuit className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg">AI Tutor</h2>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> Online
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex gap-1">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-6 bg-slate-950 border-t border-slate-800">
        <div className="flex gap-3">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="p-4 bg-indigo-600 rounded-2xl hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- LEADERBOARD SCREEN ---
function LeaderboardScreen({ setView, user, level, xp }: any) {
  const players = [
    { name: 'Alex', level: 42, xp: 4200, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex' },
    { name: 'Sarah', level: 38, xp: 3850, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah' },
    { name: 'Rahul', level: 35, xp: 3500, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rahul' },
    { name: user?.name, level, xp, avatar: user?.avatar, isMe: true },
    { name: 'Priya', level: 31, xp: 3100, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Priya' },
    { name: 'Sam', level: 28, xp: 2800, avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sam' },
  ].sort((a, b) => b.xp - a.xp);

  return (
    <div className="pb-24 max-w-2xl mx-auto min-h-screen">
      <div className="p-6 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" /> Global Rankings
        </h2>
      </div>

      <div className="p-6 space-y-4">
        {players.map((p, i) => (
          <motion.div 
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`flex items-center gap-4 p-4 rounded-2xl border ${
              p.isMe ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className={`w-8 font-bold text-xl ${i < 3 ? 'text-yellow-500' : 'text-slate-500'}`}>
              #{i + 1}
            </div>
            <img src={p.avatar} alt="Avatar" className="w-12 h-12 rounded-full bg-slate-800" />
            <div className="flex-1">
              <h4 className="font-bold">{p.name} {p.isMe && '(You)'}</h4>
              <p className="text-xs text-slate-400">Level {p.level}</p>
            </div>
            <div className="text-right">
              <div className="font-bold text-indigo-400">{p.xp} XP</div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Score</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around items-center max-w-4xl mx-auto z-20">
        <NavButton icon={<BrainCircuit/>} label="Play" onClick={() => setView('home')} />
        <NavButton icon={<MessageSquare/>} label="AI Tutor" onClick={() => setView('chat')} />
        <NavButton icon={<Trophy/>} label="Rank" active onClick={() => setView('leaderboard')} />
        <NavButton icon={<User/>} label="Profile" onClick={() => setView('profile')} />
      </div>
    </div>
  );
}

// --- PROFILE SCREEN ---
function ProfileScreen({ setView, user, setUser, level, coins, xp, showToast, unlockedAchievements, ACHIEVEMENTS, gameMode, setGameMode, difficulty, setDifficulty, quizTimer, setQuizTimer, userStats, speechVoice, setSpeechVoice, speechRate, setSpeechRate, ttsEnabled, setTtsEnabled }: any) {
  const [showAchievements, setShowAchievements] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [showStats, setShowStats] = useState(true);
  
  const stats = [
    { label: 'Total XP', value: xp, icon: <Star className="w-5 h-5 text-amber-400" /> },
    { label: 'Coins', value: coins, icon: <Zap className="w-5 h-5 text-yellow-500" /> },
    { label: 'Level', value: level, icon: <Award className="w-5 h-5 text-indigo-400" /> },
    { label: 'Badges', value: unlockedAchievements.length, icon: <Target className="w-5 h-5 text-emerald-400" /> },
  ];

  const handleLogout = () => {
    setUser(null);
    setView('login');
    showToast('Logged out successfully');
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto min-h-screen">
      <div className="p-6 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-800 rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold">Profile</h2>
      </div>

      <div className="p-6 space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <img src={user?.avatar} alt="Avatar" className="w-32 h-32 rounded-full bg-slate-800 border-4 border-indigo-500 shadow-2xl" />
            <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 rounded-full border-4 border-slate-950">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div onClick={() => {
            const newName = prompt('Enter new name:', user?.name);
            if (newName) setUser({ ...user, name: newName });
          }} className="cursor-pointer hover:opacity-80 transition-opacity">
            <h3 className="text-3xl font-extrabold">{user?.name}</h3>
            <p className="text-slate-400 font-medium">Joined via {user?.platform}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
              <div className="p-3 bg-slate-800 rounded-2xl">{s.icon}</div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Learning Progress Charts */}
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-indigo-400" />
              <span className="font-bold">Learning Progress</span>
            </div>
            <button 
              onClick={() => setShowStats(!showStats)}
              className="text-xs text-indigo-400 font-bold hover:underline"
            >
              {showStats ? 'Hide' : 'Show'}
            </button>
          </div>

          <AnimatePresence>
            {showStats && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-8 overflow-hidden"
              >
                {Object.keys(userStats.topics).length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                      <BrainCircuit className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-500 italic">No progress data yet. Start a quiz to see your performance!</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Topic Accuracy (%)</h4>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={Object.entries(userStats.topics).map(([name, s]: any) => ({
                              name: name.length > 10 ? name.substring(0, 10) + '...' : name,
                              accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                            })).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5)} 
                            layout="vertical" 
                            margin={{ left: -20, right: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={80} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                              itemStyle={{ color: '#818cf8' }}
                            />
                            <Bar dataKey="accuracy" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Difficulty Mastery</h4>
                      <div className="h-64 w-full flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={Object.entries(userStats.difficulties).map(([name, s]: any) => ({
                            subject: name.charAt(0).toUpperCase() + name.slice(1),
                            accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
                          }))}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar
                              name="Accuracy"
                              dataKey="accuracy"
                              stroke="#818cf8"
                              fill="#818cf8"
                              fillOpacity={0.6}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                <span className="font-bold">Learning Mode</span>
              </div>
              <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700">
                <button 
                  onClick={() => setGameMode('quiz')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${gameMode === 'quiz' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                >
                  Quiz
                </button>
                <button 
                  onClick={() => setGameMode('study')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${gameMode === 'study' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                >
                  Study
                </button>
              </div>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={gameMode}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-slate-800/50 p-3 rounded-xl flex items-center gap-3 border border-slate-700/50"
              >
                {gameMode === 'quiz' ? (
                  <>
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <p className="text-xs text-slate-400">Competitive mode with timer and bonus XP. Test your speed!</p>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    <p className="text-xs text-slate-400">Learning mode with no timer and detailed conceptual explanations.</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-indigo-400" />
                <span className="font-bold">Difficulty Level</span>
              </div>
              <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700">
                {(['easy', 'hard', 'advance'] as const).map((d) => (
                  <button 
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all uppercase tracking-tighter ${difficulty === d ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              * Adjust the complexity of questions generated by AI.
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span className="font-bold">Quiz Timer</span>
              </div>
              <div className="text-indigo-400 font-bold bg-indigo-600/20 px-3 py-1 rounded-full text-sm border border-indigo-500/30">
                {quizTimer}s
              </div>
            </div>
            
            <div className="px-2">
              <input 
                type="range" 
                min="10" 
                max="60" 
                step="5"
                value={quizTimer}
                onChange={(e) => setQuizTimer(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                <span>Fast (10s)</span>
                <span>Relaxed (60s)</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              * Adjust the time you get for each question in Quiz Mode.
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-indigo-400" />
                <span className="font-bold">Speech Settings</span>
              </div>
            </div>
            
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">TTS (Text-to-Speech)</span>
                <button 
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${ttsEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ttsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Voice Gender</span>
                <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700">
                  <button 
                    onClick={() => setSpeechVoice('female')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${speechVoice === 'female' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                  >
                    Female
                  </button>
                  <button 
                    onClick={() => setSpeechVoice('male')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${speechVoice === 'male' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
                  >
                    Male
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Speech Rate</span>
                  <span className="text-indigo-400 font-bold bg-indigo-600/20 px-3 py-1 rounded-full text-xs border border-indigo-500/30">
                    {speechRate}x
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  <span>Slow</span>
                  <span>Normal</span>
                  <span>Fast</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              * Customize how AI pronounces questions and answers.
            </p>
          </div>

          <button 
            onClick={() => setShowAchievements(!showAchievements)}
            className="w-full flex items-center justify-between p-5 bg-slate-900 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-indigo-400" />
              <span className="font-bold">Achievements</span>
            </div>
            <ChevronRight className={`w-5 h-5 text-slate-600 transition-transform ${showAchievements ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showAchievements && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3"
              >
                {ACHIEVEMENTS.map((achievement: any) => {
                  const isUnlocked = unlockedAchievements.includes(achievement.id);
                  return (
                    <div 
                      key={achievement.id}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        isUnlocked ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-900/50 border-slate-800 opacity-50 grayscale'
                      }`}
                    >
                      <div className={`p-3 rounded-xl ${isUnlocked ? 'bg-indigo-600/20' : 'bg-slate-800'}`}>
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-bold ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>{achievement.title}</h4>
                        <p className="text-xs text-slate-500">{achievement.desc}</p>
                      </div>
                      {isUnlocked && (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setShowMastery(!showMastery)}
            className="w-full flex items-center justify-between p-5 bg-slate-900 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="font-bold">Mastery Badges</span>
              {userStats.masteryBadges?.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {userStats.masteryBadges.length}
                </span>
              )}
            </div>
            <ChevronRight className={`w-5 h-5 text-slate-600 transition-transform ${showMastery ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showMastery && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3"
              >
                {userStats.masteryBadges?.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                    <Target className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No mastery badges yet. Achieve 90% accuracy in a topic with 10+ questions to unlock!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {userStats.masteryBadges.map((topic: string) => (
                      <div 
                        key={topic}
                        className="flex items-center gap-4 p-4 bg-emerald-900/10 border border-emerald-500/30 rounded-2xl"
                      >
                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                          <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-white capitalize">{topic} Master</h4>
                          <p className="text-xs text-emerald-500/70">Unlocked with 90%+ Accuracy</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button className="w-full flex items-center justify-between p-5 bg-slate-900 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="font-bold">Settings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 p-5 bg-red-900/20 text-red-400 rounded-2xl border border-red-900/30 hover:bg-red-900/30 transition-colors font-bold"
          >
            <LogOut className="w-5 h-5" /> Log Out
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around items-center max-w-4xl mx-auto z-20">
        <NavButton icon={<BrainCircuit/>} label="Play" onClick={() => setView('home')} />
        <NavButton icon={<MessageSquare/>} label="AI Tutor" onClick={() => setView('chat')} />
        <NavButton icon={<Trophy/>} label="Rank" onClick={() => setView('leaderboard')} />
        <NavButton icon={<User/>} label="Profile" active onClick={() => setView('profile')} />
      </div>
    </div>
  );
}
