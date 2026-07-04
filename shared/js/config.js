(function (global) {
  'use strict';

  const BASE = '/hostel/';

  const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyBy2E0rFGh0quXssZSiQVofwE2C-f5Mt2w',
    authDomain:        'dekuthostels.firebaseapp.com',
    projectId:         'dekuthostels',
    storageBucket:     'dekuthostels.firebasestorage.app',
    messagingSenderId: '984307401520',
    appId:             '1:984307401520:web:ac69f3b466d9030ce0fef5',
    measurementId:     'G-LBT4TFGHE8'
  };

  const SITE = {
    name:           'DKUT Hostels',
    shortName:      'DKUT Hostels',
    url:            'https://dkutservices.co.ke/hostel/',
    description:    'Find verified, affordable student hostels near Dedan Kimathi University of Technology in Nyeri, Kenya.',
    phone:          '+254700000000',
    whatsapp:       '254700000000',
    email:          'hostels@dkutservices.co.ke',
    university:     'Dedan Kimathi University of Technology',
    city:           'Nyeri',
    country:        'Kenya',
    currency:       'KES',
    currencySymbol: 'KSh',
  };

  const LOCATIONS = [
    { id: 'all',         label: 'All Areas',   icon: 'fa-map',            color: '#8b7ec8' },
    { id: 'gate-a',      label: 'Gate A',      icon: 'fa-door-open',      color: '#3b82f6' },
    { id: 'gate-b',      label: 'Gate B',      icon: 'fa-door-closed',    color: '#8b5cf6' },
    { id: 'boma',        label: 'Boma',        icon: 'fa-building',       color: '#f59e0b' },
    { id: 'embassy',     label: 'Embassy',     icon: 'fa-landmark',       color: '#ef4444' },
    { id: 'nyeri-view',  label: 'Nyeri View',  icon: 'fa-mountain',       color: '#06b6d4' },
    { id: 'main-campus', label: 'Main Campus', icon: 'fa-university',     color: '#10b981' },
    { id: 'mathari',     label: 'Mathari',     icon: 'fa-map-marker-alt', color: '#f97316' },
    { id: 'mweiga',      label: 'Mweiga',      icon: 'fa-location-dot',   color: '#ec4899' },
  ];

  const NAV_ITEMS = [
    { id: 'home',         label: 'Home',        icon: 'home',        href: pageUrl('pages/home/') },
    { id: 'locations',    label: 'Locations',   icon: 'locations',   href: pageUrl('pages/locations/') },
    { id: 'scam-reports', label: 'Scam Alerts', icon: 'scam',        href: pageUrl('pages/scam-reports/') },
    { id: 'report-issue', label: 'Report',      icon: 'report',      href: pageUrl('pages/report-issue/') },
  ];

  const AMENITY_ICONS = {
    wifi:        { icon: 'fa-wifi',            label: 'WiFi' },
    water:       { icon: 'fa-droplet',         label: 'Water' },
    electricity: { icon: 'fa-bolt',            label: 'Electricity' },
    security:    { icon: 'fa-shield-halved',   label: 'Security' },
    cctv:        { icon: 'fa-video',           label: 'CCTV' },
    parking:     { icon: 'fa-square-parking',  label: 'Parking' },
    gym:         { icon: 'fa-dumbbell',        label: 'Gym' },
    laundry:     { icon: 'fa-shirt',           label: 'Laundry' },
    kitchen:     { icon: 'fa-utensils',        label: 'Kitchen' },
    bed:         { icon: 'fa-bed',             label: 'Bed & Mattress' },
    gate:        { icon: 'fa-lock',            label: 'Gate Access' },
    study:       { icon: 'fa-book-open',       label: 'Study Room' },
    cleaning:    { icon: 'fa-broom',           label: 'Cleaning' },
    bathroom:    { icon: 'fa-shower',          label: 'Bathroom' },
    solar:       { icon: 'fa-sun',             label: 'Solar Power' },
    generator:   { icon: 'fa-plug',            label: 'Generator' },
    'hot water': { icon: 'fa-temperature-high', label: 'Hot Water' },
  };

  const IMAGE_CATEGORIES = {
    bedroom:  ['bedroom', 'bed', 'room', 'sleeping', 'single', 'double', 'bedsitter', 'interior', 'inside'],
    kitchen:  ['kitchen', 'cook', 'cooking', 'stove', 'gas', 'appliance'],
    bathroom: ['bathroom', 'toilet', 'shower', 'wash', 'bath', 'wc', 'restroom'],
    exterior: ['exterior', 'outside', 'gate', 'entrance', 'building', 'compound', 'front', 'facade'],
    common:   ['common', 'lounge', 'lobby', 'hall', 'corridor', 'sitting', 'living'],
    other:    [],
  };

  const SETTINGS = {
    dataPath: '../../shared/data/hostels.json',
    mockDataPath: '../../shared/data/hostels.mock.json',
    cacheKey: 'dkut_hostels_cache',
    mockCacheKey: 'dkut_hostels_mock_cache',
    mockStorageKey: 'dkut_mock_mode',
    cacheTTL: 3600000,
    pageSize: 12,
  };

  function getAppRoot() {
    const path = location.pathname;
    const pagesIdx = path.indexOf('/pages/');
    if (pagesIdx >= 0) return path.slice(0, pagesIdx + 1);

    // Dynamic root detection for Vercel/localhost clean URLs
    if (location.hostname.includes('vercel.app') || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return '/';
    }

    const hostelMatch = path.match(/^(.*\/hostel\/)/i);
    if (hostelMatch) return hostelMatch[1];
    if (path.endsWith('/')) return path;
    return path.replace(/\/[^/]*$/, '/');
  }

  function pageUrl(relative) {
    const rel = String(relative || '').replace(/^\//, '');
    
    // Separate query string/hash
    const parts = rel.split(/([?#])/);
    let path = parts[0];
    const rest = parts.slice(1).join('');
    
    const root = getAppRoot();
    if (root === '/') {
      // Clean URLs for root hosting (e.g., Vercel)
      let clean = path.replace(/^pages\//i, '');
      clean = clean.replace(/\/index\.html$/i, '');
      clean = clean.replace(/\/$/, '');
      if (clean === 'home' || clean === '') {
        return '/' + rest;
      }
      return '/' + clean + rest;
    } else {
      // Standard full URLs for subdirectory/static hosting
      return root + rel;
    }
  }

  function dataUrl() {
    return new URL('shared/data/hostels.json', new URL(getAppRoot(), location.origin)).href;
  }

  function mockDataUrl() {
    return new URL('shared/data/hostels.mock.json', new URL(getAppRoot(), location.origin)).href;
  }

  global.DKUT = global.DKUT || {};
  global.DKUT.CONFIG = {
    BASE,
    getAppRoot,
    pageUrl,
    dataUrl,
    mockDataUrl,
    FIREBASE: FIREBASE_CONFIG,
    SITE,
    LOCATIONS,
    NAV_ITEMS,
    AMENITY_ICONS,
    IMAGE_CATEGORIES,
    SETTINGS,
  };
})(window);
