/**
 * Servio Food Module
 * Handles food listing, posting, claiming, and detail view.
 */

const Food = {
  currentList: [],
  currentFoodId: null,
  searchQuery: "",
  categoryFilter: "all",

  async loadList(status = "available") {
    const res = await Api.food.list(status);
    if (res.ok) {
      Food.currentList = res.data;
      Food.applyFilters();
    } else {
      document.getElementById("food-grid").innerHTML =
        '<p class="empty-state">Failed to load food posts.</p>';
    }
  },

  applyFilters() {
    let list = Food.currentList;

    // Apply category filter (from dashboard quick action)
    if (Food.categoryFilter && Food.categoryFilter !== "all") {
      const cat = Food.categoryFilter.toLowerCase();
      if (cat === "veg") {
        list = list.filter(f => f.food_type === "veg");
      } else if (cat === "meals") {
        const mealsKeywords = ["meal", "rice", "curry", "lunch", "dinner", "food", "hotel", "restaurant", "roti", "biryani"];
        list = list.filter(f => 
          mealsKeywords.some(kw => f.org_name.toLowerCase().includes(kw) || (f.pickup_address && f.pickup_address.toLowerCase().includes(kw)))
        );
      } else if (cat === "bakery") {
        const bakeryKeywords = ["bakery", "bread", "cake", "cookie", "pastry", "bun", "biscuit", "croissant", "donut", "bake"];
        list = list.filter(f => 
          bakeryKeywords.some(kw => f.org_name.toLowerCase().includes(kw) || (f.pickup_address && f.pickup_address.toLowerCase().includes(kw)))
        );
      } else if (cat === "beverages") {
        const bevKeywords = ["drink", "juice", "beverage", "water", "tea", "coffee", "milk", "shake", "soda", "cola"];
        list = list.filter(f => 
          bevKeywords.some(kw => f.org_name.toLowerCase().includes(kw) || (f.pickup_address && f.pickup_address.toLowerCase().includes(kw)))
        );
      } else if (cat === "fruits") {
        const fruitKeywords = ["fruit", "apple", "banana", "orange", "grape", "mango", "berry", "pear", "peach"];
        list = list.filter(f => 
          fruitKeywords.some(kw => f.org_name.toLowerCase().includes(kw) || (f.pickup_address && f.pickup_address.toLowerCase().includes(kw)))
        );
      } else if (cat === "surplus") {
        const surplusKeywords = ["surplus", "extra", "leftover", "excess", "buffet", "party", "event", "caterer"];
        list = list.filter(f => 
          surplusKeywords.some(kw => f.org_name.toLowerCase().includes(kw) || (f.pickup_address && f.pickup_address.toLowerCase().includes(kw)))
        );
      }
    }

    // Apply search query (from dashboard search input)
    if (Food.searchQuery) {
      const q = Food.searchQuery.toLowerCase().trim();
      list = list.filter(f => 
        f.org_name.toLowerCase().includes(q) || 
        (f.pickup_address && f.pickup_address.toLowerCase().includes(q)) ||
        (f.food_type || "").toLowerCase().includes(q) ||
        (f.quality || "").toLowerCase().includes(q)
      );
    }

    // Apply sidebar/dropdown filters (from food list page)
    const type = document.getElementById("food-filter-type")?.value;
    const quality = document.getElementById("food-filter-quality")?.value;

    if (type) {
      list = list.filter((f) => f.food_type === type);
    }
    if (quality) {
      list = list.filter((f) => f.quality === quality);
    }

    Food.renderGrid(list);
  },

  renderGrid(foods) {
    const grid = document.getElementById("food-grid");
    if (!foods.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="empty-state-icon">🍽️</span>
          <span>No food donations found right now.</span>
          <p style="font-size:0.82rem;color:var(--text-muted);">Check back soon or broaden your filters.</p>
        </div>`;
      return;
    }

    grid.innerHTML = "";
    foods.forEach((food, i) => {
      const card = Food.createCard(food);
      card.style.animationDelay = `${i * 50}ms`;
      card.classList.add('slide-up');
      grid.appendChild(card);
    });
  },

  createCard(food) {
    const card = document.createElement("div");
    card.className = "food-card";
    card.dataset.id = food.id;

    const expiry = new Date(food.expiry_time);
    const now = new Date();
    const hoursLeft = Math.round((expiry - now) / 3600000);
    const expiryText =
      hoursLeft < 0 ? "⚠️ Expired"
      : hoursLeft < 2 ? `⚠️ ${hoursLeft}h left`
      : hoursLeft < 24 ? `⏰ ${hoursLeft}h left`
      : expiry.toLocaleDateString();
    const expiryColor = hoursLeft < 0 ? 'color:var(--danger);font-weight:700;'
      : hoursLeft < 2 ? 'color:var(--warning);font-weight:700;' : '';

    const typeEmoji = food.food_type === 'veg' ? '🥦' : '🍗';
    const qualityEmoji = food.quality === 'fresh' ? '✨' : food.quality === 'good' ? '👍' : '🆗';

    // Image section
    const imgSection = food.image_path
      ? `<img src="/uploads/food/${food.image_path}" alt="${escapeHtml(food.org_name)}" />`
      : `<img src="food_card.png" alt="${escapeHtml(food.org_name)}" style="object-fit:cover;" />`;

    card.innerHTML = `
      <div class="food-card-img">
        ${imgSection}
        <button class="food-card-add-btn" title="View details">+</button>
      </div>
      <div class="food-card-body">
        <div class="food-card-title">${escapeHtml(food.org_name)}</div>
        <div class="food-card-meta">
          <span class="badge badge-${food.food_type === 'veg' ? 'veg' : 'nonveg'}">${typeEmoji} ${food.food_type === 'veg' ? 'Veg' : 'Non-Veg'}</span>
          <span class="badge badge-${food.quality}">${qualityEmoji} ${food.quality}</span>
          <span class="badge badge-${food.status}">${food.status}</span>
        </div>
        <div class="food-card-location">
          <span>📍</span>
          <span>${escapeHtml((food.pickup_address || '—').substring(0, 40))}${food.pickup_address && food.pickup_address.length > 40 ? '…' : ''}</span>
        </div>
      </div>
      <div class="food-card-footer">
        <span class="food-qty">⚖️ ${food.quantity} kg</span>
        <span class="food-expiry" style="${expiryColor}">${expiryText}</span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.food-card-add-btn')) {
        Food.showDetail(food.id);
        App.showPage('food-detail');
      } else {
        Food.showDetail(food.id);
        App.showPage('food-detail');
      }
    });
    return card;
  },

  async showDetail(foodId) {
    Food.currentFoodId = foodId;

    // Show loading state
    const container = document.getElementById('food-detail-content');
    container.innerHTML = '<div class="loading-spinner"></div>';

    const res = await Api.food.get(foodId);
    if (!res.ok) {
      showToast('Failed to load food details.', 'error');
      return;
    }

    const food = res.data;
    const role = Auth.getRole();
    const expiry = new Date(food.expiry_time);
    const now = new Date();
    const hoursLeft = Math.round((expiry - now) / 3600000);
    const expiryColor = hoursLeft < 0 ? 'var(--danger)' : hoursLeft < 4 ? 'var(--warning)' : 'var(--text)';
    const typeEmoji = food.food_type === 'veg' ? '🥦' : '🍗';
    const qualityEmoji = food.quality === 'fresh' ? '✨' : food.quality === 'good' ? '👍' : '🆗';

    // Hero image
    const heroContent = food.image_path
      ? `<img src="/uploads/food/${food.image_path}" alt="${escapeHtml(food.org_name)}" />`
      : `<img src="food_card.png" alt="${escapeHtml(food.org_name)}" style="width:100%;height:100%;object-fit:cover;" />`;

    container.innerHTML = `
      <div class="detail-hero">
        ${heroContent}
        <div class="detail-hero-overlay"></div>
      </div>

      <div class="detail-card slide-up">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <h2 class="detail-title">${escapeHtml(food.org_name)}</h2>
          <span class="badge badge-${food.status}" style="font-size:0.8rem;padding:6px 14px;">● ${food.status}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          <span class="badge badge-${food.food_type === 'veg' ? 'veg' : 'nonveg'}">${typeEmoji} ${food.food_type === 'veg' ? 'Vegetarian' : 'Non-Veg'}</span>
          <span class="badge badge-${food.quality}">${qualityEmoji} ${food.quality.charAt(0).toUpperCase() + food.quality.slice(1)}</span>
        </div>

        <div class="detail-info-grid">
          <div class="detail-field">
            <label>⚖️ Quantity Available</label>
            <p>${food.quantity} kg</p>
          </div>
          <div class="detail-field">
            <label>⏰ Expiry Time</label>
            <p style="color:${expiryColor}">${expiry.toLocaleString()}</p>
          </div>
          <div class="detail-field">
            <label>📍 Pickup Address</label>
            <p>${escapeHtml(food.pickup_address || '—')}</p>
          </div>
          <div class="detail-field">
            <label>👤 Donated By</label>
            <p>${escapeHtml(food.donor_name || '—')}</p>
          </div>
          ${food.donor_phone ? `
          <div class="detail-field">
            <label>📞 Contact</label>
            <p><a href="tel:${escapeHtml(food.donor_phone)}" style="color:var(--teal);font-weight:600;">${escapeHtml(food.donor_phone)}</a></p>
          </div>` : ''}
          <div class="detail-field">
            <label>🕐 Posted On</label>
            <p>${new Date(food.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</p>
          </div>
        </div>
      </div>

      <div class="detail-cta" id="detail-actions"></div>
    `;

    // Render action buttons
    const actionsEl = document.getElementById('detail-actions');
    Food.renderDetailActions(actionsEl, food, role);
  },

  renderDetailActions(container, food, role) {
    container.innerHTML = '';
    const buttons = [];

    if (role === 'recipient' || role === 'individual') {
      if (food.status === 'available') {
        buttons.push({ label: '✅ Claim This Donation', cls: 'btn-primary', fn: () => Food.claimFood(food.id) });
      }
      if (food.status === 'waiting' && food.claimed_by === Auth.currentUser?.id) {
        buttons.push({ label: '🚚 Mark as Delivered', cls: 'btn-teal', fn: () => Food.markDelivered(food.id) });
        buttons.push({ label: '📷 Upload Proof', cls: 'btn-secondary', fn: () => openVerifyModal(food.id) });
        buttons.push({ label: '⚠️ Unable to Deliver', cls: 'btn-danger', fn: () => Food.markExpired(food.id) });
      }
    }

    if (role === 'donor' && food.donor_id === Auth.currentUser?.id) {
      if (food.status === 'claimed') {
        buttons.push({ label: '✅ Confirm Receipt', cls: 'btn-success', fn: () => Food.markReceived(food.id) });
      }
      if (food.status === 'available') {
        buttons.push({ label: '⚠️ Mark Almost Wasted', cls: 'btn-danger', fn: () => Food.markExpired(food.id) });
      }
    }

    if (!buttons.length) {
      // Show status info if no actions available
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;text-align:center;color:var(--text-muted);font-size:0.88rem;padding:4px 0;';
      info.textContent = food.status === 'delivered' ? '✅ This donation has been delivered.' :
        food.status === 'expired' ? '⚠️ This donation has expired.' :
        food.status === 'claimed' ? '🔵 This donation is currently claimed.' : '🔒 No actions available.';
      container.appendChild(info);
      return;
    }

    buttons.forEach(({ label, cls, fn }) => {
      const btn = document.createElement('button');
      btn.className = `btn ${cls}`;
      btn.style.flex = '1';
      btn.style.height = '52px';
      btn.textContent = label;
      btn.addEventListener('click', fn);
      container.appendChild(btn);
    });
  },

  async claimFood(foodId) {
    const res = await Api.food.claim(foodId);
    if (res.ok) {
      showToast("Food claimed! Status set to waiting.", "success");
      Food.showDetail(foodId);
    } else {
      showToast(res.data.error || "Failed to claim food.", "error");
    }
  },

  async markDelivered(foodId) {
    const res = await Api.food.deliver(foodId);
    if (res.ok) {
      showToast("Delivery confirmed!", "success");
      Food.showDetail(foodId);
    } else {
      showToast(res.data.error || "Failed to update status.", "error");
    }
  },

  async markReceived(foodId) {
    const res = await Api.food.received(foodId);
    if (res.ok) {
      showToast("Food delivery confirmed. Thank you!", "success");
      Food.showDetail(foodId);
    } else {
      showToast(res.data.error || "Failed to confirm receipt.", "error");
    }
  },

  async markExpired(foodId) {
    if (!confirm("Mark this food as expired/wasted? It will be forwarded to a decomposition center.")) return;
    const res = await Api.food.expire(foodId);
    if (res.ok) {
      showToast("Food marked as expired and forwarded to decomposition.", "warning");
      Food.showDetail(foodId);
    } else {
      showToast(res.data.error || "Failed to update status.", "error");
    }
  },
};

// ===== POST FOOD MODAL =====

function initPostFoodUI() {
  const form = document.getElementById("post-food-form");
  const pfLocationBtn = document.getElementById("pf-location-btn");
  const pfImage = document.getElementById("pf-image");
  const pfFileName = document.getElementById("pf-file-name");

  pfLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    pfLocationBtn.textContent = "📍 Getting...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById("pf-lat").value = pos.coords.latitude;
        document.getElementById("pf-lon").value = pos.coords.longitude;
        pfLocationBtn.textContent = "✅ Location set";
      },
      () => {
        pfLocationBtn.textContent = "📍 Use My Location";
        showToast("Could not get location.", "warning");
      }
    );
  });

  pfImage.addEventListener("change", () => {
    pfFileName.textContent = pfImage.files[0]?.name || "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("pf-error");
    const submitBtn = form.querySelector("button[type=submit]");
    errorEl.classList.add("hidden");

    const formData = new FormData();
    formData.append("org_name", document.getElementById("pf-org").value);
    formData.append("food_type", document.getElementById("pf-type").value);
    formData.append("quantity", document.getElementById("pf-qty").value);
    formData.append("quality", document.getElementById("pf-quality").value);
    formData.append("expiry_time", document.getElementById("pf-expiry").value);
    formData.append("pickup_address", document.getElementById("pf-address").value);
    formData.append("latitude", document.getElementById("pf-lat").value);
    formData.append("longitude", document.getElementById("pf-lon").value);

    const imageFile = document.getElementById("pf-image").files[0];
    if (imageFile) formData.append("image", imageFile);

    submitBtn.textContent = "Posting…";
    submitBtn.disabled = true;

    const res = await Api.food.post(formData);

    submitBtn.textContent = "Post Donation →";
    submitBtn.disabled = false;

    if (res.ok) {
      closeModal("modal-post-food");
      form.reset();
      pfFileName.textContent = "";
      showToast("Food posted successfully! Nearby recipients notified.", "success");
      Food.loadList();
    } else {
      errorEl.textContent = res.data.error || "Failed to post food.";
      errorEl.classList.remove("hidden");
    }
  });
}

// ===== DECOMPOSITION MODAL =====

function initDecompUI() {
  const form = document.getElementById("decomp-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("dc-error");
    const submitBtn = form.querySelector("button[type=submit]");
    errorEl.classList.add("hidden");

    const data = {
      quantity: parseFloat(document.getElementById("dc-qty").value),
      food_type: document.getElementById("dc-type").value,
      address: document.getElementById("dc-address").value,
    };

    submitBtn.textContent = "Submitting...";
    submitBtn.disabled = true;

    const res = await Api.decomposition.create(data);

    submitBtn.textContent = "Submit Request";
    submitBtn.disabled = false;

    if (res.ok) {
      closeModal("modal-decomp");
      form.reset();
      showToast(`Decomposition request sent to: ${res.data.assigned_to}`, "success");
    } else {
      errorEl.textContent = res.data.error || "Failed to submit request.";
      errorEl.classList.remove("hidden");
    }
  });
}

// ===== VERIFICATION MODAL =====

function openVerifyModal(foodId) {
  document.getElementById("verify-food-id").value = foodId;
  openModal("modal-verify");
}

function initVerifyUI() {
  const form = document.getElementById("verify-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const foodId = document.getElementById("verify-food-id").value;
    const errorEl = document.getElementById("verify-error");
    const submitBtn = form.querySelector("button[type=submit]");
    errorEl.classList.add("hidden");

    const formData = new FormData();
    const imageFile = document.getElementById("verify-image").files[0];
    const videoFile = document.getElementById("verify-video").files[0];
    const notes = document.getElementById("verify-notes").value;

    if (imageFile) formData.append("image", imageFile);
    if (videoFile) formData.append("video", videoFile);
    formData.append("notes", notes);

    submitBtn.textContent = "Uploading...";
    submitBtn.disabled = true;

    const res = await Api.verification.upload(foodId, formData);

    submitBtn.textContent = "Upload Proof";
    submitBtn.disabled = false;

    if (res.ok) {
      closeModal("modal-verify");
      form.reset();
      showToast("Verification proof uploaded. Donor has been notified.", "success");
    } else {
      errorEl.textContent = res.data.error || "Upload failed.";
      errorEl.classList.remove("hidden");
    }
  });
}

// ===== FILTER =====

function initFoodFilters() {
  document.getElementById("apply-filter-btn").addEventListener("click", () => {
    Food.applyFilters();
  });
}

// ===== HELPERS =====

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
