export const registerNewUser = async ({ email, password, nickName }) => {
  const response = await fetch(import.meta.env.VITE_BACKEND + "/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, nickName }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json.data;
};

export const loginUser = async ({ email, password }) => {
  const response = await fetch(import.meta.env.VITE_BACKEND + "/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json.token;
};

export const getMyUserDataService = async ({ token }) => {
  const response = await fetch(import.meta.env.VITE_BACKEND + "/user", {
    headers: {
      Authorization: token,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json.user;
};

export const getRecommendationsService = async () => {
  const response = await fetch(
    import.meta.env.VITE_BACKEND + "/recommendations"
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json.recommendations;
};

export const getRecommendationByIdService = async () => {
  const id = window.location.pathname.split("/").pop();
  const response = await fetch(
    import.meta.env.VITE_BACKEND + `/recommendations/${id}`
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  console.log(json);

  return json;
};

export const editRecommendationService = async (
  title,
  category,
  description,
  locationId,
  token
) => {
  const id = window.location.pathname.split("/").pop();
  const response = await fetch(
    import.meta.env.VITE_BACKEND + `/edit-recommendations/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ title, category, description, locationId }),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json;
};

export const getCommentsService = async () => {
  const response = await fetch(
    "http://localhost:3000/recomendations/?/comentarios"
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }
  return json.comments;
};

export const postCreateRecommendationService = async (
  title,
  category,
  description,
  country,
  lean_in,
  token
) => {
  const response = await fetch(
    import.meta.env.VITE_BACKEND + "/recommendations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ title, category, description, country, lean_in }),
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json.data;
};

export const deleteRecommendationService = async (token) => {
  const id = window.location.pathname.split("/").pop();
  const response = await fetch(
    import.meta.env.VITE_BACKEND + `/delete-recommendations/${id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message);
  }

  return json;
};
