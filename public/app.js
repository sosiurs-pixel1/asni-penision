(function () {
    'use strict';

    // ========== Configuration ==========
    const API_BASE = '/api'; // Vercel proxy -> Cloudflare Worker -> D1

    // ========== DOM Cache ==========
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        tabBtns: $$('.tab-btn'),
        roomForm: $('#room-form'),
        restaurantForm: $('#restaurant-form'),
        bookingForm: $('#booking-form'),
        restaurantBookingForm: $('#restaurant-booking-form'),
        lookupBtn: $('#lookup-btn'),
        lookupEmail: $('#lookup-email'),
        bookingsList: $('#bookings-list'),
        toast: $('#toast'),
        toastContent: $('#toast-content')
    };

    // ========== Utilities ==========
    const Utils = {
        showToast(message, type = 'success') {
            const colors = {
                success: 'bg-emerald-600',
                error: 'bg-red-600',
                info: 'bg-blue-600'
            };
            els.toastContent.className = `rounded-lg shadow-lg p-4 text-white text-sm ${colors[type] || colors.success}`;
            els.toastContent.textContent = message;
            els.toast.classList.remove('translate-y-20', 'opacity-0');
            clearTimeout(Utils._toastTimer);
            Utils._toastTimer = setTimeout(() => {
                els.toast.classList.add('translate-y-20', 'opacity-0');
            }, 3500);
        },

        formatDate(iso) {
            if (!iso) return '';
            return new Date(iso).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        },

        escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        setMinDates() {
            const today = new Date().toISOString().split('T')[0];
            ['#check-in', '#check-out', '#rest-date'].forEach(sel => {
                const el = $(sel);
                if (el) el.min = today;
            });
        }
    };

    // ========== API Layer ==========
    const API = {
        async request(endpoint, options = {}) {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
            return data;
        },

        createBooking(payload) {
            return API.request('/bookings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        },

        getBookings(email) {
            return API.request(`/bookings?email=${encodeURIComponent(email)}`);
        }
    };

    // ========== Tab Controller ==========
    const Tabs = {
        init() {
            els.tabBtns.forEach(btn => {
                btn.addEventListener('click', () => Tabs.switch(btn.dataset.tab));
            });
        },
        switch(tab) {
            els.tabBtns.forEach(btn => {
                const active = btn.dataset.tab === tab;
                btn.classList.toggle('bg-emerald-600', active);
                btn.classList.toggle('text-white', active);
                btn.classList.toggle('text-gray-600', !active);
                btn.classList.toggle('hover:bg-gray-100', !active);
            });
            els.roomForm.classList.toggle('hidden', tab !== 'room');
            els.restaurantForm.classList.toggle('hidden', tab !== 'restaurant');
        }
    };

    // ========== Form Handlers ==========
    const Forms = {
        validateDates(checkIn, checkOut) {
            if (new Date(checkOut) <= new Date(checkIn)) {
                throw new Error('Check-out must be after check-in');
            }
        },

        async submitRoomBooking(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Booking...';

            try {
                const checkIn = $('#check-in').value;
                const checkOut = $('#check-out').value;
                Forms.validateDates(checkIn, checkOut);

                const payload = {
                    type: 'room',
                    name: $('#guest-name').value.trim(),
                    email: $('#guest-email').value.trim(),
                    phone: $('#guest-phone').value.trim(),
                    roomType: $('#room-type').value,
                    checkIn,
                    checkOut,
                    guests: parseInt($('#num-guests').value, 10),
                    requests: $('#special-requests').value.trim()
                };

                const result = await API.createBooking(payload);
                Utils.showToast(`Booking confirmed! ID: ${result.id}`, 'success');
                e.target.reset();
                if (els.lookupEmail.value.trim()) Forms.lookup();
            } catch (err) {
                Utils.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        },

        async submitRestaurantBooking(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Reserving...';

            try {
                const payload = {
                    type: 'restaurant',
                    name: $('#rest-name').value.trim(),
                    email: $('#rest-email').value.trim(),
                    phone: $('#rest-phone').value.trim(),
                    date: $('#rest-date').value,
                    time: $('#rest-time').value,
                    guests: parseInt($('#rest-guests').value, 10),
                    tablePreference: $('#table-pref').value,
                    requests: $('#rest-requests').value.trim()
                };

                const result = await API.createBooking(payload);
                Utils.showToast(`Table reserved! ID: ${result.id}`, 'success');
                e.target.reset();
                if (els.lookupEmail.value.trim()) Forms.lookup();
            } catch (err) {
                Utils.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        },

        async lookup() {
            const email = els.lookupEmail.value.trim();
            if (!email) {
                Utils.showToast('Please enter an email', 'error');
                return;
            }
            els.bookingsList.innerHTML = `<div class="text-center text-gray-400 py-8 text-sm">Loading...</div>`;
            try {
                const data = await API.getBookings(email);
                Forms.renderBookings(data.bookings || []);
            } catch (err) {
                els.bookingsList.innerHTML = '';
                Utils.showToast(err.message, 'error');
            }
        },

        renderBookings(bookings) {
            if (!bookings.length) {
                els.bookingsList.innerHTML = `
                    <div class="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500 text-sm">
                        No bookings found for this email.
                    </div>`;
                return;
            }

            els.bookingsList.innerHTML = bookings.map(b => {
                const isRoom = b.type === 'room';
                const badge = isRoom
                    ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Room</span>'
                    : '<span class="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Restaurant</span>';

                const details = isRoom
                    ? `
                        <p class="text-xs text-gray-600 mt-1">${Utils.escapeHtml(b.room_type || '')} · ${b.guests} guest(s)</p>
                        <p class="text-xs text-gray-600">${Utils.formatDate(b.check_in)} → ${Utils.formatDate(b.check_out)}</p>
                    `
                    : `
                        <p class="text-xs text-gray-600 mt-1">${Utils.formatDate(b.date)} at ${Utils.escapeHtml(b.time || '')}</p>
                        <p class="text-xs text-gray-600">${b.guests} guest(s) · ${Utils.escapeHtml(b.table_preference || 'any')}</p>
                    `;

                return `
                    <div class="bg-white rounded-lg shadow-sm p-4 border-l-4 ${isRoom ? 'border-emerald-500' : 'border-amber-500'}">
                        <div class="flex justify-between items-start gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    ${badge}
                                    <span class="text-xs text-gray-400">#${Utils.escapeHtml(b.id)}</span>
                                </div>
                                <p class="text-sm font-medium text-gray-800 mt-2">${Utils.escapeHtml(b.name)}</p>
                                ${details}
                                ${b.requests ? `<p class="text-xs text-gray-500 italic mt-1">"${Utils.escapeHtml(b.requests)}"</p>` : ''}
                            </div>
                            <span class="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-full font-medium whitespace-nowrap">
                                ${Utils.escapeHtml(b.status || 'pending')}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        },

        init() {
            els.bookingForm.addEventListener('submit', Forms.submitRoomBooking);
            els.restaurantBookingForm.addEventListener('submit', Forms.submitRestaurantBooking);
            els.lookupBtn.addEventListener('click', Forms.lookup);
            els.lookupEmail.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') Forms.lookup();
            });

            // Auto-set checkout when checkin changes
            $('#check-in').addEventListener('change', (e) => {
                const co = $('#check-out');
                if (!co.value || co.value <= e.target.value) {
                    const d = new Date(e.target.value);
                    d.setDate(d.getDate() + 1);
                    co.value = d.toISOString().split('T')[0];
                }
                co.min = e.target.value;
            });
        }
    };

    // ========== Bootstrap ==========
    function init() {
        Utils.setMinDates();
        Tabs.init();
        Forms.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
