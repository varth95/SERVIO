/**
 * Servio Food Module
 * Handles food listing, posting, claiming, and detail view.
 */

const Food = {
  currentList: [],
  currentFoodId: null,

  async loadList(status = "available") {
    const res = await Api.food.list(status);
    if (res.ok) {
      Food.currentList = res.data;
      Food.renderGrid(res.data);
    } else {
      document.getElementById("food-grid").innerHTML =
        '<p class="empty-state">Failed to load food posts.</p>';
    }
  },

  renderGrid(foods) {
    const grid = document.getElementById("food-grid");
    if (!foods.length) {
      grid.innerHTML = '<p class="empty-state">🍽️ No food posts found.</p>';
      return;
    }

    grid.innerHTML = "";
    grid.classList.add("stagger-children");

    foods.forEach((food) => {
      const card = Food.createCard(food);
      grid.appendChild(card);
    });
  },

  createCard(food) {
    const card = document.createElement("div");
    card.className = "food-card";
    card.dataset.id = food.id;

    const imgContent = food.image_path
      ? `<img src="/uploads/food/${food.image_path}" alt="${food.org_name}" />`
      : `<span>${food.food_type === "veg" ? "🥦" : "🍗"}</span>`;

    const expiry = new Date(food.expiry_time);
    const now = new Date();
    const hoursLeft = Math.round((expiry - now) / 3600000);
    const expiryText =
      hoursLeft < 0
        ? "⚠️ Expired"
        : hoursLeft < 2
        ? `⚠️ ${hoursLeft}h left`
        : expiry.toLocaleString();
    const expiryClass = hoursLeft < 2 ? "color: var(--danger);" : "";

    card.innerHTML = `
      <div class="food-card-img">${imgContent}</div>
      <div class="food-card-body">
        <div class="food-card-title">${escapeHtml(food.org_name)}</div>
        <div class="food-card-meta">
          <span class="badge badge-${food.food_type === "veg" ? "veg" : "nonveg"}">
            ${food.food_type === "veg" ? "🥦 Veg" : "🍗 Non-Veg"}
          </span>
          <span class="badge badge-${food.quality}">${food.quality}</span>
          <span class="badge badge-${food.status}">${food.status}</span>
        </div>
        <div style="font-size:0.85rem; color: var(--text-light);">
          📍 ${escapeHtml(food.pickup_address || "—")}
        </div>
      </div>
      <div class="food-card-footer">
        <span class="food-qty">⚖️ ${food.quantity} kg</span>
        <span class="food-expiry" style="${expiryClass}">${expiryText}</span>
      </div>
    `;

    card.addEventListener("click", () => Food.showDetail(food.id));
    return card;
  },

  async showDetail(foodId) {
    Food.currentFoodId = foodId;
    const res = await Api.food.get(foodId);
    if (!res.ok) {
      showToast("Failed to load food details.", "error");
      return;
    }

    const food = res.data;
    const container = document.getElementById("food-detail-content");
    const role = Auth.getRole();

    const imgContent = food.image_path
      ? `<div class="detail-image"><img src="/uploads/food/${food.image_path}" alt="${food.org_name}" /></div>`
      : `<div class="detail-image" style="height:200px; background: linear-gradient(135deg,#f8f9fa,#e9ecef);">${food.food_type === "veg" ? "🥦" : "🍗"}</div>`;

    const expiry = new Date(food.expiry_time);

    container.innerHTML = `
      ${imgContent}
      <div class="card">
        <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:0.5rem;">${escapeHtml(food.org_name)}</h2>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;">
          <span class="badge badge-${food.food_type === "veg" ? "veg" : "nonveg"}">${food.food_type === "veg" ? "🥦 Veg" : "🍗 Non-Veg"}</span>
          <span class="badge badge-${food.quality}">${food.quality}</span>
          <span class="badge badge-${food.status}">${food.status}</span>
        </div>
        <div class="detail-info">
          <div class="detail-field"><label>Quantity</label><p>⚖️ ${food.quantity} kg</p></div>
          <div class="detail-field"><label>Expiry</label><p>⏰ ${expiry.toLocaleString()}</p></div>
          <div class="detail-field"><label>Pickup Address</label><p>📍 ${escapeHtml(food.pickup_address)}</p></div>
          <div class="detail-field"><label>Donor</label><p>👤 ${escapeHtml(food.donor_name || "—")}</p></div>
          ${food.donor_phone ? `<div class="detail-field"><label>Contact</label><p>📞 ${escapeHtml(food.donor_phone)}</p></div>` : ""}
          <div class="detail-field"><label>Posted</label><p>${new Date(food.created_at).toLocaleString()}</p></div>
        </div>
      </div>
      <div class="detail-actions" id="detail-actions"></div>
    `;

    // Render action buttons based on role and status
    const actionsEl = document.getElementById("detail-actions");
    Food.renderDetailActions(actionsEl, food, role);

    App.showPage("food-detail");
  },

  renderDetailActions(container, food, role) {
    container.innerHTML = "";

    if (role === "recipient" || role === "individual") {
      if (food.status === "available") {
        const claimBtn = document.createElement("button");
        claimBtn.className = "btn btn-primary";
        claimBtn.textContent = "✅ Claim This Food";
        claimBtn.addEventListener("click", () => Food.claimFood(food.id));
        container.appendChild(claimBtn);
      }

      if (food.status === "waiting" && food.claimed_by === Auth.currentUser?.id) {
        const deliverBtn = document.createElement("button");
        deliverBtn.className = "btn btn-success";
        deliverBtn.textContent = "🚚 Mark as Delivered";
        deliverBtn.addEventListener("click", () => Food.markDelivered(food.id));
        container.appendChild(deliverBtn);

        const verifyBtn = document.createElement("button");
        verifyBtn.className = "btn btn-secondary";
        verifyBtn.textContent = "📷 Upload Proof";
        verifyBtn.addEventListener("click", () => openVerifyModal(food.id));
        container.appendChild(verifyBtn);

        const expireBtn = document.createElement("button");
        expireBtn.className = "btn btn-danger";
        expireBtn.textContent = "⚠️ Unable to Deliver";
        expireBtn.addEventListener("click", () => Food.markExpired(food.id));
        container.appendChild(expireBtn);
      }
    }

    if (role === "donor" && food.donor_id === Auth.currentUser?.id) {
      if (food.status === "claimed") {
        const receivedBtn = document.createElement("button");
        receivedBtn.className = "btn btn-success";
        receivedBtn.textContent = "✅ Confirm Receipt";
        receivedBtn.addEventListener("click", () => Food.markReceived(food.id));
        container.appendChild(receivedBtn);
      }

      if (food.status === "available") {
        const expireBtn = document.createElement("button");
        expireBtn.className = "btn btn-danger";
        expireBtn.textContent = "⚠️ Mark Almost Wasted";
        expireBtn.addEventListener("click", () => Food.markExpired(food.id));
        container.appendChild(expireBtn);
      }
    }
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

    submitBtn.textContent = "Posting...";
    submitBtn.disabled = true;

    const res = await Api.food.post(formData);

    submitBtn.textContent = "Post Food";
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
    const type = document.getElementById("food-filter-type").value;
    const quality = document.getElementById("food-filter-quality").value;

    let filtered = Food.currentList;
    if (type) filtered = filtered.filter((f) => f.food_type === type);
    if (quality) filtered = filtered.filter((f) => f.quality === quality);
    Food.renderGrid(filtered);
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
