import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyAYDBTrG2RNwVOyKEsxt_-Vyu9JhVb5dNs",
  authDomain: "zexus-8c69d.firebaseapp.com",
  projectId: "zexus-8c69d",
  storageBucket: "zexus-8c69d.firebasestorage.app",
  messagingSenderId: "856434117801",
  appId: "1:856434117801:web:aba02727a0ce94e1516db8",

  databaseURL:
    "https://zexus-8c69d-default-rtdb.asia-southeast1.firebasedatabase.app"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);


const state = {
  user: null,
  posts: [],
  category: "ALL",
  search: ""
};


const routes = {
  home: document.querySelector("#homeView"),
  rank: document.querySelector("#rankView"),
  drop: document.querySelector("#dropView"),
  profile: document.querySelector("#profileView")
};


const feed = document.querySelector("#feed");
const ranking = document.querySelector("#ranking");
const feedState = document.querySelector("#feedState");
const rankingState = document.querySelector("#rankingState");
const profileSummary = document.querySelector("#profileSummary");
const profilePosts = document.querySelector("#profilePosts");
const template = document.querySelector("#postTemplate");

const form = document.querySelector("#dropForm");
const formStatus = document.querySelector("#formStatus");
const editingId = document.querySelector("#editingId");
const publishButton = document.querySelector("#publishButton");
const cancelEditButton = document.querySelector("#cancelEditButton");

const usernameInput = document.querySelector("#usernameInput");
const categoryInput = document.querySelector("#categoryInput");
const messageInput = document.querySelector("#messageInput");
const pfpInput = document.querySelector("#pfpInput");
const imageInput = document.querySelector("#imageInput");
const messageCount = document.querySelector("#messageCount");


const fallbackAvatar =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="#242424"/>
      <text x="50" y="60" text-anchor="middle"
        fill="#aaa" font-size="42" font-family="Arial">Z</text>
    </svg>
  `);


function select(selector) {
  return document.querySelector(selector);
}


function setStatus(message) {
  formStatus.textContent = message || "";
}


function showEmpty(element, message) {
  element.textContent = message;
  element.classList.remove("hidden");
}


function hideEmpty(element) {
  element.textContent = "";
  element.classList.add("hidden");
}


function currentRoute() {
  const route = location.hash.replace("#", "").toLowerCase();

  if (routes[route]) {
    return route;
  }

  return "home";
}


function navigate() {
  const route = currentRoute();

  Object.entries(routes).forEach(([name, element]) => {
    element.classList.toggle("hidden", name !== route);
  });

  document.querySelectorAll(".bottom-nav a").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.route === route
    );
  });
}


function formatTime(timestamp) {
  if (!timestamp) {
    return "just now";
  }

  const date = new Date(timestamp);
  const difference = Math.max(
    0,
    Date.now() - date.getTime()
  );

  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}


function hasVoted(postId) {
  return localStorage.getItem(
    `zexus-voted-${postId}`
  ) === "1";
}


function getFilteredPosts() {
  const search = state.search.trim().toLowerCase();

  return state.posts.filter(post => {
    const categoryMatches =
      state.category === "ALL" ||
      String(post.category || "").toUpperCase() ===
      state.category;

    const searchMatches =
      !search ||
      String(post.username || "").toLowerCase().includes(search) ||
      String(post.message || "").toLowerCase().includes(search);

    return categoryMatches && searchMatches;
  });
}


async function uploadImage(file, folder, maxMegabytes) {
  if (!file) {
    return "";
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "Only JPG, PNG, or WEBP images are allowed."
    );
  }

  if (file.size > maxMegabytes * 1024 * 1024) {
    throw new Error(
      `Image must be smaller than ${maxMegabytes} MB.`
    );
  }

  const safeName = file.name.replace(
    /[^a-z0-9.]/gi,
    "-"
  );

  const path =
    `${folder}/${state.user.uid}/` +
    `${Date.now()}-${safeName}`;

  const fileReference = storageRef(storage, path);

  await uploadBytes(fileReference, file, {
    contentType: file.type
  });

  return getDownloadURL(fileReference);
}


async function createPost(postData) {
  const postsReference = ref(db, "posts");
  const newPostReference = push(postsReference);

  await set(newPostReference, {
    ...postData,
    ownerId: state.user.uid,
    votes: 0,
    visibility: "public",
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
}


async function updatePost(postId, postData) {
  await update(ref(db, `posts/${postId}`), {
    ...postData,
    updatedAt: Date.now()
  });
}


async function deletePost(post) {
  if (
    !state.user ||
    post.ownerId !== state.user.uid
  ) {
    setStatus(
      "You can only delete your own line."
    );
    return;
  }

  const confirmed = confirm(
    "Delete this line permanently?"
  );

  if (!confirmed) {
    return;
  }

  await remove(ref(db, `posts/${post.id}`));

  setStatus("Line deleted.");
}


async function votePost(post) {
  if (!state.user) {
    setStatus("Connecting your account...");
    return;
  }

  if (hasVoted(post.id)) {
    setStatus("You already voted on this line.");
    return;
  }

  const votesReference = ref(
    db,
    `posts/${post.id}/votes`
  );

  await runTransaction(
    votesReference,
    currentVotes => {
      return Number(currentVotes || 0) + 1;
    }
  );

  localStorage.setItem(
    `zexus-voted-${post.id}`,
    "1"
  );
}


async function copyLine(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Line copied.");
  } catch {
    setStatus(
      "Copy is not supported in this browser."
    );
  }
}


function renderPost(post, target) {
  const fragment =
    template.content.cloneNode(true);

  const card =
    fragment.querySelector(".post-card");

  const avatar =
    fragment.querySelector(".avatar");

  const username =
    fragment.querySelector(".post-username");

  const time =
    fragment.querySelector(".post-time");

  const category =
    fragment.querySelector(".post-category");

  const message =
    fragment.querySelector(".post-message");

  const image =
    fragment.querySelector(".post-image");

  const voteButton =
    fragment.querySelector(".vote-button");

  const voteCount =
    fragment.querySelector(".vote-count");

  const copyButton =
    fragment.querySelector(".copy-button");

  const editButton =
    fragment.querySelector(".edit-button");

  const deleteButton =
    fragment.querySelector(".delete-button");


  avatar.src = post.pfpUrl || fallbackAvatar;
  username.textContent =
    post.username || "anonymous";

  time.textContent =
    formatTime(post.createdAt);

  category.textContent =
    String(post.category || "Random").toUpperCase();

  message.textContent =
    post.message || "";

  voteCount.textContent =
    Number(post.votes || 0);


  if (post.imageUrl) {
    image.src = post.imageUrl;
    image.classList.remove("hidden");
  }


  if (hasVoted(post.id)) {
    voteButton.classList.add("voted");
  }


  if (
    state.user &&
    post.ownerId === state.user.uid
  ) {
    editButton.classList.remove("hidden");
    deleteButton.classList.remove("hidden");

    editButton.addEventListener(
      "click",
      () => startEditing(post)
    );

    deleteButton.addEventListener(
      "click",
      () => {
        deletePost(post).catch(error => {
          setStatus(
            error.message || "Delete failed."
          );
        });
      }
    );
  }


  voteButton.addEventListener(
    "click",
    () => {
      votePost(post).catch(error => {
        setStatus(
          error.message || "Vote failed."
        );
      });
    }
  );


  copyButton.addEventListener(
    "click",
    () => copyLine(post.message || "")
  );


  card.dataset.postId = post.id;
  target.appendChild(fragment);
}


function renderFeed() {
  feed.innerHTML = "";

  if (!state.posts.length) {
    showEmpty(
      feedState,
      "No lines yet. First drop tum karo."
    );
    return;
  }

  const posts = getFilteredPosts();

  if (!posts.length) {
    showEmpty(
      feedState,
      "Nothing found."
    );
    return;
  }

  hideEmpty(feedState);

  posts.forEach(post => {
    renderPost(post, feed);
  });
}


function renderRanking() {
  ranking.innerHTML = "";

  const rankedPosts = [...state.posts]
    .sort((first, second) => {
      return Number(second.votes || 0) -
        Number(first.votes || 0);
    })
    .slice(0, 50);

  if (!rankedPosts.length) {
    showEmpty(
      rankingState,
      "No rankings yet."
    );
    return;
  }

  hideEmpty(rankingState);

  rankedPosts.forEach((post, index) => {
    const row = document.createElement("article");
    row.className = "rank-card";

    const number = document.createElement("div");
    number.className = "rank-number";
    number.textContent =
      String(index + 1).padStart(2, "0");

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.src = post.pfpUrl || fallbackAvatar;
    avatar.alt = "";

    const details = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent =
      post.username || "anonymous";

    const line = document.createElement("div");
    line.className = "rank-message";
    line.textContent =
      post.message || "";

    details.append(name, line);

    const votes = document.createElement("div");
    votes.className = "rank-votes";
    votes.textContent =
      `${Number(post.votes || 0)} ▲`;

    row.append(
      number,
      avatar,
      details,
      votes
    );

    ranking.appendChild(row);
  });
}


function renderProfile() {
  profilePosts.innerHTML = "";

  if (!state.user) {
    profileSummary.innerHTML =
      "<p>Connecting your profile...</p>";
    return;
  }

  const ownPosts = state.posts.filter(post => {
    return post.ownerId === state.user.uid;
  });

  const totalVotes = ownPosts.reduce(
    (total, post) => {
      return total + Number(post.votes || 0);
    },
    0
  );

  const firstPost = ownPosts[0];

  profileSummary.innerHTML = "";

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src =
    firstPost?.pfpUrl || fallbackAvatar;
  avatar.alt = "";

  const info = document.createElement("div");

  const name = document.createElement("strong");
  name.textContent =
    firstPost?.username ||
    "Your anonymous profile";

  const metrics = document.createElement("div");
  metrics.className = "profile-metrics";
  metrics.textContent =
    `${ownPosts.length} lines · ` +
    `${totalVotes} votes received`;

  info.append(name, metrics);
  profileSummary.append(avatar, info);

  if (!ownPosts.length) {
    profilePosts.innerHTML =
      `<div class="empty-state">
        You have not dropped anything yet.
      </div>`;
    return;
  }

  ownPosts.forEach(post => {
    renderPost(post, profilePosts);
  });
}


function renderAll() {
  renderFeed();
  renderRanking();
  renderProfile();
}


function startEditing(post) {
  location.hash = "#drop";

  editingId.value = post.id;
  usernameInput.value = post.username || "";
  categoryInput.value = post.category || "";
  messageInput.value = post.message || "";

  messageCount.textContent =
    messageInput.value.length;

  publishButton.textContent =
    "UPDATE LINE";

  cancelEditButton.classList.remove(
    "hidden"
  );

  setStatus("Editing your line.");
}


function clearForm() {
  form.reset();

  editingId.value = "";
  publishButton.textContent = "DROP IT";

  cancelEditButton.classList.add(
    "hidden"
  );

  messageCount.textContent = "0";
  setStatus("");
}


form.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    if (!state.user) {
      setStatus(
        "Still connecting. Try again."
      );
      return;
    }

    const username =
      usernameInput.value.trim();

    const category =
      categoryInput.value;

    const message =
      messageInput.value.trim();

    const editId =
      editingId.value;

    const pfpFile =
      pfpInput.files[0];

    const postImageFile =
      imageInput.files[0];


    if (
      username.length < 2 ||
      username.length > 24
    ) {
      setStatus(
        "Username must be 2–24 characters."
      );
      return;
    }

    if (!category) {
      setStatus(
        "Choose a category."
      );
      return;
    }

    if (
      !message ||
      message.length > 500
    ) {
      setStatus(
        "Message must be between 1 and 500 characters."
      );
      return;
    }


    publishButton.disabled = true;
    setStatus(
      "Uploading and publishing..."
    );

    try {
      let pfpUrl = "";
      let imageUrl = "";

      if (pfpFile) {
        pfpUrl =
          await uploadImage(
            pfpFile,
            "pfp",
            3
          );
      }

      if (postImageFile) {
        imageUrl =
          await uploadImage(
            postImageFile,
            "posts",
            5
          );
      }

      const postData = {
        username,
        category,
        message
      };

      if (pfpUrl) {
        postData.pfpUrl = pfpUrl;
      }

      if (imageUrl) {
        postData.imageUrl = imageUrl;
      }


      if (editId) {
        const existingPost =
          state.posts.find(
            post => post.id === editId
          );

        if (
          !existingPost ||
          existingPost.ownerId !==
          state.user.uid
        ) {
          throw new Error(
            "You can only edit your own line."
          );
        }

        await updatePost(
          editId,
          postData
        );

        setStatus(
          "Your line was updated."
        );
      } else {
        await createPost(postData);

        setStatus(
          "Your line is live."
        );
      }

      clearForm();
      location.hash = "#home";
    } catch (error) {
      console.error(error);

      setStatus(
        error.message ||
        "Publish failed."
      );
    } finally {
      publishButton.disabled = false;
    }
  }
);


cancelEditButton.addEventListener(
  "click",
  () => {
    clearForm();
    location.hash = "#home";
  }
);


messageInput.addEventListener(
  "input",
  () => {
    messageCount.textContent =
      messageInput.value.length;
  }
);


select("#searchInput").addEventListener(
  "input",
  event => {
    state.search = event.target.value;
    renderFeed();
  }
);


select("#categoryFilters").addEventListener(
  "click",
  event => {
    const button =
      event.target.closest(
        "[data-category]"
      );

    if (!button) {
      return;
    }

    state.category =
      button.dataset.category;

    document.querySelectorAll(
      ".filter"
    ).forEach(filter => {
      filter.classList.toggle(
        "active",
        filter === button
      );
    });

    renderFeed();
  }
);


window.addEventListener(
  "hashchange",
  navigate
);


navigate();


onAuthStateChanged(
  auth,
  user => {
    state.user = user;

    select("#authStatus").textContent =
      user ? "CONNECTED" : "OFFLINE";

    renderAll();
  }
);


signInAnonymously(auth).catch(error => {
  console.error(error);

  select("#authStatus").textContent =
    "AUTH ERROR";

  setStatus(
    "Anonymous Authentication is not enabled."
  );
});


const postsReference =
  ref(db, "posts");


onValue(
  postsReference,
  snapshot => {
    const data =
      snapshot.val() || {};

    state.posts = Object.entries(data)
      .map(([id, post]) => ({
        id,
        ...post
      }))
      .filter(post => {
        return post.visibility === "public";
      })
      .sort((first, second) => {
        return Number(second.createdAt || 0) -
          Number(first.createdAt || 0);
      });

    renderAll();
  },
  error => {
    console.error(error);

    showEmpty(
      feedState,
      "Feed unavailable. Check Firebase Rules."
    );

    showEmpty(
      rankingState,
      "Rankings unavailable."
    );
  }
);
