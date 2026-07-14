import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Calendar, 
  MapPin, 
  Award, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  Mail, 
  Heart, 
  Info, 
  ArrowRight, 
  ExternalLink, 
  Menu, 
  X,
  ArrowUpRight
} from 'lucide-react';
import contentData from './data/content.json';

interface ContentData {
  firstName: string;
  spreadsheetId?: string;
  tagline: string;
  heroDescription: string;
  donationUrl: string;
  fundraising: {
    target: number;
    raised: number;
    currency: string;
    supportersCount: number;
  };
  story: {
    paragraphs: string[];
  };
  jamboreeInfo: {
    location: string;
    dates: string;
    theme: string;
    description: string;
    facts: { label: string; value: string }[];
  };
  scoutingImpact: {
    title: string;
    desc: string;
    emoji: string;
  }[];
  activities: {
    id: number;
    title: string;
    date: string;
    desc: string;
    raised: number;
    status: string;
    actionText: string;
    image: string;
  }[];
  updates: {
    id: number;
    date: string;
    title: string;
    desc: string;
    image: string;
  }[];
  safeguarding: {
    contactEmail: string;
    parentName: string;
    notice: string;
  };
}

// Helper to parse standard CSV rows
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  const rows = text.split(/\r?\n/);
  for (const row of rows) {
    if (!row.trim()) continue;
    const values: string[] = [];
    let insideQuote = false;
    let currentValue = '';
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    const cleanValues = values.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
    lines.push(cleanValues);
  }
  return lines;
}

// Helper to convert Google Drive share links into direct image URLs
function getDirectImageUrl(url: string): string {
  if (!url) return '';
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return url;
}

export default function App() {
  const data = contentData as ContentData;
  const { fundraising, safeguarding, activities, updates } = data;

  // Google Sheet Dynamic Data State
  const [sheetData, setSheetData] = useState<{
    raised: number;
    target: number;
    supportersCount: number;
    activities: any[];
    updates: any[];
  } | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);

  // Fallback / Active Variable Resolvers
  const activeRaised = sheetData ? sheetData.raised : fundraising.raised;
  const activeTarget = sheetData ? sheetData.target : fundraising.target;
  const activeSupporters = sheetData ? sheetData.supportersCount : fundraising.supportersCount;
  const activeActivities = sheetData ? sheetData.activities : activities;
  const activeUpdates = sheetData ? sheetData.updates : updates;

  // Fetch Google Sheets data on mount
  useEffect(() => {
    const spreadsheetId = data.spreadsheetId;
    if (!spreadsheetId || spreadsheetId === 'YOUR_SPREADSHEET_ID') return;

    async function fetchSheet() {
      setLoadingSheet(true);
      try {
        const fetchTab = async (tabName: string) => {
          const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch tab ${tabName}`);
          const text = await res.text();
          return parseCSV(text);
        };

        const [generalRows, activitiesRows, updatesRows] = await Promise.all([
          fetchTab('General'),
          fetchTab('Activities'),
          fetchTab('Updates')
        ]);

        // General Info parsing
        let raised = data.fundraising.raised;
        let target = data.fundraising.target;
        let supportersCount = data.fundraising.supportersCount;

        generalRows.forEach(row => {
          if (row.length >= 2) {
            const key = row[0].toLowerCase().trim();
            const val = parseFloat(row[1].replace(/[^0-9.]/g, ''));
            if (!isNaN(val)) {
              if (key === 'raised') raised = val;
              if (key === 'target') target = val;
              if (key === 'supporters') supportersCount = Math.round(val);
            }
          }
        });

        // Activities parsing (columns: Title, Date, Description, Raised, Status, ActionText, Image)
        const parsedActivities = activitiesRows.slice(1).map((row, idx) => ({
          id: idx + 1,
          title: row[0] || 'Activity',
          date: row[1] || 'Upcoming',
          desc: row[2] || '',
          raised: parseFloat((row[3] || '').replace(/[^0-9.]/g, '')) || 0,
          status: (row[4] || 'upcoming').toLowerCase().trim(),
          actionText: row[5] || 'Sponsor me',
          image: row[6] || 'images/story_hiking.png'
        }));

        // Updates parsing (columns: Date, Title, Description, Image)
        const parsedUpdates = updatesRows.slice(1).map((row, idx) => ({
          id: idx + 1,
          date: row[0] || '',
          title: row[1] || 'Update',
          desc: row[2] || '',
          image: row[3] || 'images/update_launch.png'
        }));

        setSheetData({
          raised,
          target,
          supportersCount,
          activities: parsedActivities.length ? parsedActivities : data.activities,
          updates: parsedUpdates.length ? parsedUpdates : data.updates
        });
      } catch (err) {
        console.error('Error fetching Google Sheet, using fallback content.json:', err);
      } finally {
        setLoadingSheet(false);
      }
    }

    fetchSheet();
  }, [data]);
  
  // Progress Bar Animation
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const targetPercent = Math.min(Math.round((activeRaised / activeTarget) * 100), 100);
  
  useEffect(() => {
    setAnimatedProgress(targetPercent);
  }, [targetPercent]);

  // Tab Navigation for Activities & Updates
  const [activeTab, setActiveTab] = useState<'activities' | 'updates'>('activities');
  const [activityFilter, setActivityFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  // Copy Link Alert State
  const [copied, setCopied] = useState(false);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Contact Form State
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    
    setIsSubmitting(true);
    // Simulate API request
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => setFormSubmitted(false), 8000); // clear banner after 8s
    }, 1200);
  };

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sticky Mobile Donate Banner Visibility
  const [showStickyDonate, setShowStickyDonate] = useState(true);

  // Dynamic QR Code generation using public free API
  const [currentUrl, setCurrentUrl] = useState('https://isobel-jamboree-2027.example.com');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(currentUrl)}&color=1b4332&bgcolor=fcfbf9`;

  // Filter activities based on selection
  const filteredActivities = activeActivities.filter(act => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'completed') return act.status === 'completed';
    if (activityFilter === 'upcoming') return act.status === 'upcoming' || act.status === 'in-progress';
    return true;
  });

  return (
    <div className="app-wrapper">
      
      {/* Sticky Mobile Donate Button */}
      {showStickyDonate && (
        <div className="sticky-donate-mobile glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(27, 67, 50, 0.15)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Support {data.firstName}'s Journey</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)' }}>
              {fundraising.currency}{activeRaised} raised of {fundraising.currency}{activeTarget}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Donate <ArrowUpRight size={14} />
            </a>
            <button onClick={() => setShowStickyDonate(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Header / Navigation */}
      <header className="header">
        <div className="container nav-container">
          <a href="#" className="logo">
            <Compass className="logo-icon" size={24} />
            <span>{data.firstName}<span>Poland2027</span></span>
          </a>

          <nav className="nav-links">
            <a href="#about">About</a>
            <a href="#story">My Story</a>
            <a href="#jamboree">The Jamboree</a>
            <a href="#activities">Fundraising & Updates</a>
            <a href="#support">How to Help</a>
            <a href="#contact">Contact</a>
            <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
              Donate Now
            </a>
          </nav>

          {/* Mobile Menu Icon */}
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: 'none', color: 'var(--primary)' }}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-warm)', borderBottom: 'var(--border-subtle)' }}>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
            <a href="#story" onClick={() => setMobileMenuOpen(false)}>My Story</a>
            <a href="#jamboree" onClick={() => setMobileMenuOpen(false)}>The Jamboree</a>
            <a href="#activities" onClick={() => setMobileMenuOpen(false)}>Fundraising & Updates</a>
            <a href="#support" onClick={() => setMobileMenuOpen(false)}>How to Help</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
            <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%' }}>
              Donate Now
            </a>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="hero" id="about">
        <div className="container hero-grid">
          <div className="hero-content">
            <h1>Help <span>{data.firstName}</span> Reach the World Scout Jamboree</h1>
            <p className="hero-desc">{data.heroDescription}</p>
            <div className="hero-actions">
              <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Support My Journey <Heart size={18} fill="currentColor" />
              </a>
              <a href="#story" className="btn btn-secondary">
                Find out more <ArrowRight size={18} />
              </a>
            </div>
          </div>
          <div className="hero-image-container">
            <div className="hero-image-frame">
              <img src="images/hero_scout_outdoors.png" alt={`${data.firstName} in Scout Uniform outdoors`} />
            </div>
            <div className="hero-badge">Poland 2027 🇵🇱</div>
          </div>
        </div>
      </section>

      {/* Fundraising Progress Section */}
      <section className="progress-section">
        <div className="container">
          <div className="progress-card glass-card">
            <div className="progress-details">
              <h3>Fundraising Progress {loadingSheet && <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(updating...)</span>}</h3>
              <div className="progress-numbers">
                <div>
                  <span className="progress-raised">{fundraising.currency}{activeRaised.toLocaleString()}</span>
                  <span className="progress-target"> raised of {fundraising.currency}{activeTarget.toLocaleString()} target</span>
                </div>
                <span className="progress-percentage">{animatedProgress}%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${animatedProgress}%` }}></div>
              </div>
              <div className="progress-meta">
                <Users size={16} style={{ color: 'var(--accent)' }} />
                <span>Supported by <strong>{activeSupporters}</strong> kind contributors so far. thank you!</span>
              </div>
            </div>
            <div className="progress-cta">
              <p>Every donation directly funds Isobel's travel, mandatory equipment, and regional training camps.</p>
              <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', padding: '14px 28px' }}>
                Donate via SumUp <ArrowUpRight size={18} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Her Story Section */}
      <section className="section" id="story">
        <div className="container">
          <h2 className="section-title">My Scouting Story</h2>
          <p className="section-subtitle">A little about who I am and what this opportunity means to me</p>
          
          <div className="story-grid">
            <div className="story-text">
              {data.story.paragraphs.map((p, index) => (
                <p key={index}>{p}</p>
              ))}
              <div style={{ marginTop: '32px' }}>
                <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  Support Isobel's target
                </a>
              </div>
            </div>
            
            <div className="story-photos">
              <div className="story-photo-wrapper">
                <img src="images/story_hiking.png" alt="Hiking in the hills" />
              </div>
              <div className="story-photo-wrapper">
                <img src="images/story_campfire.png" alt="Campfire in the woods" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is the World Scout Jamboree? */}
      <section className="section jamboree-section" id="jamboree">
        <div className="container">
          <h2 className="section-title">What is the World Scout Jamboree?</h2>
          <p className="section-subtitle">Understanding the global event taking place in Gdańsk, Poland</p>
          
          <div className="jamboree-grid">
            <div className="jamboree-card">
              <p style={{ fontSize: '1.1rem', marginBottom: '24px', opacity: 0.9 }}>
                {data.jamboreeInfo.description}
              </p>
              
              <div className="jamboree-details">
                <div className="jamboree-item">
                  <div className="jamboree-item-icon">
                    <MapPin size={20} />
                  </div>
                  <div className="jamboree-item-text">
                    <h4>Where</h4>
                    <p>{data.jamboreeInfo.location}</p>
                  </div>
                </div>
                
                <div className="jamboree-item">
                  <div className="jamboree-item-icon">
                    <Calendar size={20} />
                  </div>
                  <div className="jamboree-item-text">
                    <h4>When</h4>
                    <p>{data.jamboreeInfo.dates}</p>
                  </div>
                </div>
                
                <div className="jamboree-item">
                  <div className="jamboree-item-icon">
                    <Award size={20} />
                  </div>
                  <div className="jamboree-item-text">
                    <h4>Jamboree Theme</h4>
                    <p>“{data.jamboreeInfo.theme}”</p>
                  </div>
                </div>
              </div>
              
              <div className="jamboree-facts-grid">
                {data.jamboreeInfo.facts.map((fact, idx) => (
                  <div className="jamboree-fact-box" key={idx}>
                    <div className="jamboree-fact-val">{fact.value}</div>
                    <div className="jamboree-fact-lbl">{fact.label}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="jamboree-map-container">
              <img src="images/jamboree_map.png" alt="Map showing travel route from London UK to Gdańsk Poland" />
              <div className="jamboree-theme-banner">Official Theme: Bravely</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Scouting Matters Section */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">What Scouting Teaches Me</h2>
          <p className="section-subtitle">How Scouting builds valuable lifelong skills through practical action</p>
          
          <div className="impact-grid">
            {data.scoutingImpact.map((item, idx) => (
              <div className="impact-card glass-card" key={idx}>
                <span className="impact-emoji">{item.emoji}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fundraising Activities & Timeline Section */}
      <section className="section" id="activities" style={{ backgroundColor: '#faf9f6' }}>
        <div className="container">
          <h2 className="section-title">Activities & Updates</h2>
          <p className="section-subtitle">Follow my fundraising progress and preparation milestones</p>
          
          {/* Tab Selection */}
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
              onClick={() => setActiveTab('activities')}
            >
              Fundraising Projects
            </button>
            <button 
              className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
              onClick={() => setActiveTab('updates')}
            >
              Journal Updates
            </button>
          </div>

          {activeTab === 'activities' ? (
            <div>
              {/* Activity Subfilters */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setActivityFilter('all')}
                  style={{ fontSize: '0.85rem', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--primary)', backgroundColor: activityFilter === 'all' ? 'var(--primary)' : 'transparent', color: activityFilter === 'all' ? 'white' : 'var(--primary)' }}
                >
                  All
                </button>
                <button 
                  onClick={() => setActivityFilter('upcoming')}
                  style={{ fontSize: '0.85rem', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--primary)', backgroundColor: activityFilter === 'upcoming' ? 'var(--primary)' : 'transparent', color: activityFilter === 'upcoming' ? 'white' : 'var(--primary)' }}
                >
                  Active & Upcoming
                </button>
                <button 
                  onClick={() => setActivityFilter('completed')}
                  style={{ fontSize: '0.85rem', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--primary)', backgroundColor: activityFilter === 'completed' ? 'var(--primary)' : 'transparent', color: activityFilter === 'completed' ? 'white' : 'var(--primary)' }}
                >
                  Completed
                </button>
              </div>

              {/* Activities Grid */}
              <div className="activities-grid">
                {filteredActivities.map((act) => (
                  <div className="activity-card glass-card" key={act.id}>
                    <div className="activity-img-wrapper">
                      <img src={getDirectImageUrl(act.image)} alt={act.title} />
                      <span className={`activity-badge ${act.status}`}>
                        {act.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="activity-content">
                      <span className="activity-date">{act.date}</span>
                      <h3>{act.title}</h3>
                      <p>{act.desc}</p>
                      
                      <div className="activity-footer">
                        <span className="activity-raised">
                          {act.raised > 0 ? `Raised: £${act.raised}` : 'Support Mia'}
                        </span>
                        
                        {act.status !== 'completed' ? (
                          <a 
                            href={data.donationUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="activity-btn sponsor"
                          >
                            {act.actionText} →
                          </a>
                        ) : (
                          <span className="activity-btn">
                            {act.actionText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Updates Timeline */
            <div className="updates-timeline">
              {activeUpdates.map((upd) => (
                <div className="update-card glass-card" key={upd.id}>
                  <div className="update-image">
                    <img src={getDirectImageUrl(upd.image)} alt={upd.title} />
                  </div>
                  <div className="update-content">
                    <span className="update-date">{upd.date}</span>
                    <h3>{upd.title}</h3>
                    <p>{upd.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Ways to Support & Share Section */}
      <section className="section" id="support">
        <div className="container">
          <h2 className="section-title">Ways to Support My Journey</h2>
          <p className="section-subtitle">There are many different ways you can help me reach Poland</p>
          
          <div className="support-grid">
            <div className="support-options">
              
              <div className="support-option glass-card">
                <div className="support-icon">
                  <Heart size={20} fill="currentColor" />
                </div>
                <div className="support-text">
                  <h4>Make a Secure Donation</h4>
                  <p>Contribute any amount securely through my SumUp payment page. All funds support Jamboree preparation fees.</p>
                  <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="support-link">
                    Donate on SumUp <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              <div className="support-option glass-card">
                <div className="support-icon">
                  <Share2 size={20} />
                </div>
                <div className="support-text">
                  <h4>Spread the Word</h4>
                  <p>Sharing this website with friends, family, or Scout alumni helps get more eyes on my journey.</p>
                  <button onClick={handleCopyLink} className="support-link">
                    Copy website link <Copy size={14} />
                  </button>
                  {copied && (
                    <span className="copied-badge">
                      <Check size={12} /> Copied URL to clipboard!
                    </span>
                  )}
                </div>
              </div>

              <div className="support-option glass-card">
                <div className="support-icon">
                  <Award size={20} />
                </div>
                <div className="support-text">
                  <h4>Business Sponsorship</h4>
                  <p>Are you a local business? I would love to discuss sponsorship or raffle prize donation options in exchange for promotion!</p>
                  <a href="#contact" className="support-link">
                    Contact Isobel's parents
                  </a>
                </div>
              </div>

            </div>

            <div className="share-card glass-card">
              <h3>Share via QR Code</h3>
              <p>Visiting a fundraiser or community event? People can scan this QR code directly with their mobile camera to open this website.</p>
              
              <div className="qr-code-box">
                <img src={qrCodeUrl} alt="QR code linking to this page" style={{ width: '160px', height: '160px' }} />
              </div>
              
              <div className="share-actions">
                <button onClick={handleCopyLink} className="btn btn-secondary" style={{ width: '100%', gap: '8px' }}>
                  {copied ? <Check size={18} style={{ color: '#10b981' }} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy Link to Share'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section & Safeguarding */}
      <section className="section contact-section" id="contact">
        <div className="container contact-grid">
          
          <div>
            <h2 className="section-title" style={{ textAlign: 'left', margin: '0 0 16px' }}>Get in Touch</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              If you have any questions, wish to support Isobel's fundraising activities, or are interested in sponsorship packages, please contact us.
            </p>
            
            <div className="safeguarding-box">
              <Info className="safeguarding-icon" size={24} />
              <div className="safeguarding-text">
                <h4>Parental & Safeguarding Notice</h4>
                <p>{safeguarding.notice}</p>
              </div>
            </div>
            
            <div className="contact-info-list">
              <div className="contact-info-item">
                <Mail className="contact-info-icon" size={18} />
                <span>Managed by: <strong>{safeguarding.parentName}</strong></span>
              </div>
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '32px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.4rem' }}>Send a Message</h3>
            
            {formSubmitted ? (
              <div className="form-success">
                Thank you! Your message has been sent successfully to Isobel's parents ({safeguarding.contactEmail}). We will respond as soon as possible.
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleFormSubmit}>
                <div className="form-group">
                  <label htmlFor="name">Your Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    required 
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Jane Doe"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">Your Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    required 
                    value={formData.email}
                    onChange={handleFormChange}
                    placeholder="jane.doe@example.com"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="message">Your Message</label>
                  <textarea 
                    id="message" 
                    name="message" 
                    rows={4} 
                    required 
                    value={formData.message}
                    onChange={handleFormChange}
                    placeholder="Hi! I'd love to sponsor Isobel or offer a raffle prize..."
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '8px' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Thank you banner */}
      <section className="thankyou-banner">
        <span className="thankyou-icon">⛺</span>
        <h2>Thank You For Your Support!</h2>
        <p>
          Every donation, share, and message of encouragement helps me get one step closer to Poland in 2027. I am incredibly grateful.
        </p>
        <a href={data.donationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '1.2rem' }}>
          Donate Now <Heart size={20} fill="currentColor" style={{ marginLeft: '4px' }} />
        </a>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <h4>Isobel's Jamboree Journey</h4>
              <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
                Fundraising website to support Isobel's selection as a UK Contingent member attending the 2027 World Scout Jamboree in Poland.
              </p>
            </div>
            
            <div className="footer-col">
              <h4>Quick Links</h4>
              <a href="#about">About Isobel</a>
              <a href="#story">My Story</a>
              <a href="#jamboree">Jamboree Info</a>
              <a href="#activities">Activities</a>
            </div>
            
            <div className="footer-col">
              <h4>Scouting Info</h4>
              <a href="https://www.scouts.org.uk" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                UK Scouts website <ExternalLink size={12} />
              </a>
              <a href="https://jamboree2027.pl" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Jamboree Poland <ExternalLink size={12} />
              </a>
            </div>
            
            <div className="footer-col">
              <h4>Safety & Privacy</h4>
              <p style={{ opacity: 0.8, fontSize: '0.8rem' }}>
                All donations support Isobel's Jamboree participation. This site compiles with UK Scout Safeguarding policies. No address, school details, or tracking codes are shared.
              </p>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Isobel & Parent {safeguarding.parentName}. All rights reserved. Created to support fundraising for the 26th World Scout Jamboree.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
