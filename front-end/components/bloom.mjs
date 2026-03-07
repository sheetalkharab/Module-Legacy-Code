import { apiService } from "../lib/api.mjs";
/**
 * Create a bloom component
 * @param {string} template - The ID of the template to clone
 * @param {Object} bloom - The bloom data
 * @returns {DocumentFragment} - The bloom fragment of UI, for items in the Timeline
 * btw a bloom object is composed thus
 * {"id": Number,
 * "sender": username,
 * "content": "string from textarea",
 * "sent_timestamp": "datetime as ISO 8601 formatted string"}

 */
const createBloom = (template, bloom) => {
  if (!bloom) return;
  const bloomFrag = document.getElementById(template).content.cloneNode(true);

  const bloomArticle = bloomFrag.querySelector("[data-bloom]");
  const bloomUsername = bloomFrag.querySelector("[data-username]");
  const bloomTime = bloomFrag.querySelector("[data-time]");
  const bloomTimeLink = bloomFrag.querySelector("a:has(> [data-time])");
  const bloomContent = bloomFrag.querySelector("[data-content]");

  bloomArticle.setAttribute("data-bloom-id", bloom.id);
  bloomUsername.setAttribute("href", `/profile/${bloom.sender}`);
  bloomUsername.textContent = bloom.sender;
  // For reblooms: show rebloom time as main time; original time can be shown in content area
  bloomTime.textContent = _formatTimestamp(bloom.sent_timestamp);
  bloomTimeLink.setAttribute("href", `/bloom/${bloom.id}`);

  if (bloom.type === "rebloom" && bloom.original_bloom_id) {
    if (!window._bloomCache) window._bloomCache = {};

    const cached = window._bloomCache[bloom.original_bloom_id];
    const renderRebloomContent = (original) => {
      bloomContent.replaceChildren();
      const strong = document.createElement("strong");
      strong.textContent = `@${original.sender}`;
      const em = document.createElement("em");
      em.textContent = original.content;
      bloomContent.append(
        "Rebloomed ",
        strong,
        document.createElement("br"),
        em,
      );
      // Show original timestamp so it's clear when the original was posted
      if (original.sent_timestamp) {
        const origTime = document.createElement("span");
        origTime.className = "bloom__original-time";
        origTime.textContent = `Original: ${_formatTimestamp(original.sent_timestamp)}`;
        bloomContent.appendChild(document.createElement("br"));
        bloomContent.appendChild(origTime);
      }
    };

    if (cached) {
      renderRebloomContent(cached);
    } else {
      apiService
        .getBloom(bloom.original_bloom_id)
        .then((original) => {
          window._bloomCache[bloom.original_bloom_id] = original;
          renderRebloomContent(original);
        })
        .catch(() => {
          bloomContent.textContent = " Rebloom (original not found)";
        });
    }
  } else {
    bloomContent.replaceChildren();
    const parts = bloom.content.split(/(\B#[^#]+)/g);

    for (const part of parts) {
      if (part.startsWith("#")) {
        const link = document.createElement("a");
        link.href = `/hashtag/${part.slice(1)}`;
        link.textContent = part;
        bloomContent.appendChild(link);
      } else {
        bloomContent.appendChild(document.createTextNode(part));
      }
    }
  }

  // --- Show rebloom count if this bloom has been rebloomed ---
  const rebloomCount = bloom.rebloom_count ?? 0;
  if (rebloomCount > 0) {
    const countEl = document.createElement("p");
    countEl.className = "bloom__rebloom-count";
    countEl.textContent =
      rebloomCount === 1 ? "1 rebloom" : `${rebloomCount} reblooms`;
    bloomArticle.appendChild(countEl);
  }

  // --- Add a Rebloom button ---
  const rebloomButton = document.createElement("button");
  rebloomButton.textContent = " Rebloom";
  rebloomButton.classList.add("rebloom-button");
  rebloomButton.addEventListener("click", async () => {
    try {
      rebloomButton.disabled = true;
      rebloomButton.textContent = "Reblooming...";
      const result = await apiService.rebloomBloom(bloom.id);

      if (result.success) {
        rebloomButton.textContent = "Rebloomed!";
      } else {
        rebloomButton.textContent = " Rebloom";
      }
    } catch (err) {
      rebloomButton.textContent = " Rebloom";
    } finally {
      rebloomButton.disabled = false;
    }
  });

  // Add the button to the bloom card (e.g., at the bottom)
  bloomArticle.appendChild(rebloomButton);

  return bloomFrag;
};

function _formatTimestamp(timestamp) {
  if (!timestamp) return "";

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    // Less than a minute
    if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    }

    // Less than an hour
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }

    // Less than a day
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h`;
    }

    // Less than a week
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays}d`;
    }

    // Format as month and day for older dates
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  } catch (error) {
    console.error("Failed to format timestamp:", error);
    return "";
  }
}

export { createBloom };
