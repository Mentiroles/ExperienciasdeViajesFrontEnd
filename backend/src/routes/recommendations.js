import crypto from "node:crypto";
import express from "express";
import fs from "fs/promises";
import path from "path";
import fileUpload from "express-fileupload";
import { loggedInGuard } from "../middlewares/logged-in-guard.js";
import { authMiddleware } from "../middlewares/auth.js";
import { PHOTOS_DIR, SERVER_HOST } from "../../constants.js";
import { wrapWithCatch } from "../utils/wrap-with-catch.js";
import { sendOK, sendOKCreated } from "../utils/response.js";
import { db } from "../database/db-connection.js";
import {
  validateCreateRecommendationPayload,
  validateAddImagePayload,
  validateEditRecommendationPayload,
  validateDeleteRecommendationPayload,
} from "../validations/reco-validations.js";
import {
  throwExistingLikeError,
  throwLikeNotFoundError,
} from "../utils/errors.js";

const router = express.Router();
router.use(authMiddleware);

// ! GET RECOMENDACIONES POR CATEGORIA, UBICACIÓN, ID O TODAS ORDENADAS POR LIKES

const PAGE_SIZE = 20;

router.get(
  "/recommendations",
  wrapWithCatch(async (req, res) => {
    const userId = req.currentUser?.id;
    const page = Number(req.query.page) || 1;
    const offset = PAGE_SIZE * (page - 1);
    const location = req.query.location;
    const category = req.query.category;
    const recommendationId = req.query.recommendationId;

    let query = `
    SELECT
    recommendations.id, title, category, locationId, recommendations.userId, description, lean_in, created_at,
    COUNT(recommendationLikes.id) as likeCount
    FROM recommendations
    LEFT JOIN locations ON recommendations.locationId = locations.id
    LEFT JOIN recommendationLikes ON recommendations.id = recommendationLikes.recommendationId
    `;

    let params = [];

    if (location && category) {
      query += `
      WHERE locations.country = ? AND category = ?
      `;
      params = [location, category];
    } else if (location) {
      query += `
      WHERE locations.country = ?
      `;
      params = [location];
    } else if (category) {
      query += `
      WHERE category = ?
      `;
      params = [category];
    } else if (recommendationId) {
      query += `
      WHERE recommendations.id = ?
      `;
      params = [recommendationId];
    }

    query += `
    GROUP BY recommendations.id
    ORDER BY likeCount DESC
    `;

    query += `
    LIMIT ${PAGE_SIZE}
    OFFSET ${offset}
    `;

    const [recommendations] = await db.execute(query, params);

    const [[recommendationCount]] = await db.execute(`
    SELECT COUNT(*) AS count FROM recommendations
    `);

    const totalPages = Math.ceil(recommendationCount.count / PAGE_SIZE);

    const finalRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => {
        const [[location]] = await db.execute(
          `SELECT id, country as name FROM locations WHERE id = ? LIMIT 1`,
          [recommendation.locationId]
        );
        const [[user]] = await db.execute(
          `SELECT id, nickName, photo FROM users WHERE id = ? LIMIT 1`,
          [recommendation.userId]
        );
        const [photoRows] = await db.execute(
          `SELECT url FROM recommendationPhotos WHERE recommendationId = ?`,
          [recommendation.id]
        );

        const photo = photoRows.map((row) => row.url);

        const [[likeCount]] = await db.execute(
          `SELECT COUNT(*) as count FROM recommendationLikes WHERE recommendationId = ?`,
          [recommendation.id]
        );

        let isLikedByCurrentUser = false;

        if (userId) {
          const [[like]] = await db.execute(
            `SELECT * FROM recommendationLikes WHERE userId = ? AND recommendationId = ? LIMIT 1
                    `,
            [userId, recommendation.id]
          );
          isLikedByCurrentUser = !!like;
        }

        const [[comments]] = await db.execute(
          `SELECT * FROM comments WHERE recommendationId = ?`,
          [recommendation.id]
        );

        return {
          ...recommendation,
          likeCount: likeCount.count,
          location,
          user,
          photo,
          comments,
          isLikedByCurrentUser,
        };
      })
    );

    sendOK(res, {
      totalPages,
      recommendations: finalRecommendations,
    });
  })
);

//! GET RECOMENDACION POR ID

router.get(
  "/recommendations/:id",
  wrapWithCatch(async (req, res) => {
    const { id } = req.params;

    const [recommendation] = await db.execute(
      `SELECT * FROM recommendations WHERE id = ?`,
      [id]
    );

    if (recommendation.length === 0) {
      throw new Error("Recommendation not found");
    }

    const [photoRows] = await db.execute(
      `SELECT url FROM recommendationPhotos WHERE recommendationId = ?`,
      [id]
    );

    const photo = photoRows.map((row) => row.url);

    const [comments] = await db.execute(
      `SELECT * FROM comments WHERE recommendationId = ?`,
      [id]
    );

    const [likes] = await db.execute(
      `SELECT userId FROM recommendationLikes WHERE recommendationId = ?`,
      [id]
    );

    const [user] = await db.execute(
      `SELECT id, nickName, email FROM users WHERE id = ?`,
      [recommendation[0].userId]
    );

    const [location] = await db.execute(
      `SELECT id, country as name FROM locations WHERE id = ?`,
      [recommendation[0].locationId]
    );

    sendOK(res, {
      recommendation: {
        ...recommendation[0],
        photos: photo,
        comments: comments,
        likes: likes,
        user: user[0],
        location: location[0],
      },
    });
  })
);

//! GET TODOS LOS PAISES

router.get(
  "/locations",
  wrapWithCatch(async (req, res) => {
    const locations = await db.execute(`SELECT * FROM locations`);
    sendOK(res, locations);
  })
);

//! GET IMAGEN

router.get(
  "/recommendations/:id/image",
  wrapWithCatch(async (req, res) => {
    const id = req.params.id;

    const [[recommendation]] = await db.execute(
      `SELECT * FROM recommendations WHERE id = ?`,
      [id]
    );

    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    const [photoRows] = await db.execute(
      `SELECT url FROM recommendationPhotos WHERE recommendationId = ?`,
      [id]
    );

    const photo = photoRows.map((row) => row.url);

    sendOK(res, {
      photos: photo,
    });
  })
);

//! GET POSTS

router.get("/users/:userId/posts-count", async (req, res) => {
  const userId = req.params.userId;

  const [[count]] = await db.execute(
    `SELECT COUNT(*) AS count FROM recommendations WHERE userId = ?`,
    [userId]
  );

  sendOK(res, { count: count.count });
});

// ! CREAR RECOMENDACIONES

const fileParser = fileUpload();

router.post(
  "/create-recommendation",
  loggedInGuard,
  fileParser,
  wrapWithCatch(async (req, res) => {
    console.log("Location:", req.body.country);
    const { title, category, country, description, lean_in } =
      await validateCreateRecommendationPayload(req.body);

    const userId = req.currentUser.id;

    const [{ insertId }] = await db.execute(
      `INSERT INTO recommendations(title, category, locationId, userId, description,lean_in) VALUES(?,?,?,?,?,?)`,
      [title, category, country, userId, description, lean_in]
    );

    const recommendationId = insertId;
    const { image } = await validateAddImagePayload({
      image: req.files?.image,
      recommendationId: recommendationId,
      userId: userId,
    });

    await fs.mkdir(PHOTOS_DIR, { recursive: true });

    const fileExtension = path.extname(image.name);

    const randomFileName = crypto.randomUUID();

    const newFilePath = `${randomFileName}${fileExtension}`;

    await image.mv(path.join(PHOTOS_DIR, newFilePath));

    const URL = `${newFilePath}`;

    const [{ insertImage }] = await db.execute(
      `INSERT INTO recommendationPhotos (recommendationId, url)
    VALUES(?,?)`,
      [recommendationId, URL]
    );

    sendOKCreated(res, recommendationId, insertId, insertImage);
  })
);

// ! EDITAR RECOMENDACIONES

router.patch(
  "/edit-recommendations/:recommendationId",
  loggedInGuard,
  fileParser,
  wrapWithCatch(async (req, res) => {
    const recommendationId = req.params.recommendationId;
    const { title, category, country, description } =
      await validateEditRecommendationPayload({
        ...req.body,
        recommendationId: recommendationId,
        userId: req.currentUser.id,
      });

    await db.execute(
      `UPDATE recommendations SET title = ?, category = ?, locationId = ?, description = ? WHERE id = ?`,
      [title, category, country, description, recommendationId]
    );

    const { image } = await validateAddImagePayload({
      image: req.files?.image,
      recommendationId: recommendationId,
      userId: req.currentUser.id,
    });

    await fs.mkdir(PHOTOS_DIR, { recursive: true });

    const fileExtension = path.extname(image.name);

    const randomFileName = crypto.randomUUID();

    const newFilePath = `${randomFileName}${fileExtension}`;

    await image.mv(path.join(PHOTOS_DIR, newFilePath));

    const URL = `${newFilePath}`;

    const [{ insertImage }] = await db.execute(
      `INSERT INTO recommendationPhotos (recommendationId, url) VALUES(?,?)`,
      [recommendationId, URL]
    );

    sendOK(res, {
      title,
      category,
      country,
      description,
      insertImage,
    });
  })
);

// ! AGREGAR IMAGENES A RECOMENDACIONES

// const fileParser = fileUpload();
// router.post(
//   "/recommendations/:id/image",
//   loggedInGuard,
//   fileParser,
//   wrapWithCatch(async (req, res) => {
//     const recommendationId = req.params.id;
//     const { image } = await validateAddImagePayload({
//       image: req.files?.image,
//       recommendationId: recommendationId,
//       userId: req.currentUser.id,
//     });

//     await fs.mkdir(PHOTOS_DIR, { recursive: true });

//     const fileExtension = path.extname(image.name);

//     const randomFileName = crypto.randomUUID();

//     const newFilePath = `${randomFileName}${fileExtension}`;

//     await image.mv(path.join(PHOTOS_DIR, newFilePath));

//     const URL = `${newFilePath}`;

//     const [{ insertImage }] = await db.execute(
//       `INSERT INTO recommendationPhotos (recommendationId, url)
//     VALUES(?,?)`,
//       [recommendationId, URL]
//     );

//     sendOKCreated(res, insertImage);
//   })
// );

// ! DELETE RECOMENDACIONES

router.delete(
  "/delete-recommendations/:id",
  loggedInGuard,
  wrapWithCatch(async (req, res) => {
    const { recommendationId } = await validateDeleteRecommendationPayload({
      recommendationId: req.params.id,
      userId: req.currentUser.id,
    });

    const [photos] = await db.execute(
      `SELECT * FROM recommendationPhotos WHERE recommendationId = ?`,
      [recommendationId]
    );

    const deletePhotosPromises = photos.map(async (photo) => {
      await fs.unlink(path.join(PHOTOS_DIR, path.basename(photo.url)));
    });
    await Promise.all(deletePhotosPromises);

    await db.execute(
      `DELETE FROM recommendationPhotos WHERE recommendationId = ?`,
      [recommendationId]
    );

    await db.execute(`DELETE FROM recommendations WHERE id = ?`, [
      recommendationId,
    ]);

    sendOK(res);
  })
);

// ! POST y DELETE  likes en recomendaciones

router.post(
  "/recommendations/:recommendationId/like",
  loggedInGuard,
  wrapWithCatch(async (req, res) => {
    const { recommendationId } = req.params;
    const currentUserId = req.currentUser.id;

    const [[existingLike]] = await db.execute(
      `SELECT * FROM recommendationLikes WHERE userId = ? AND recommendationId = ? LIMIT 1`,
      [currentUserId, recommendationId]
    );

    if (existingLike) {
      throwExistingLikeError();
    }

    await db.execute(
      `INSERT INTO recommendationLikes (userId, recommendationId) VALUES(?,?)`,
      [currentUserId, recommendationId]
    );

    sendOKCreated(res);
  })
);

router.delete(
  "/recommendations/:recommendationId/like",
  loggedInGuard,
  wrapWithCatch(async (req, res) => {
    const { recommendationId } = req.params;
    const userId = req.currentUser.id;

    const result = await db.execute(
      `DELETE FROM recommendationLikes WHERE userId = ? AND recommendationId = ?`,
      [userId, recommendationId]
    );

    if (result[0].affectedRows > 0) {
      sendOK(res, { message: "Like deleted successfully" });
    } else {
      throwLikeNotFoundError();
    }
  })
);

router.get(
  "/recommendations/:recommendationId/like-count",
  wrapWithCatch(async (req, res) => {
    const { recommendationId } = req.params;

    const [likeCount] = await db.execute(
      `SELECT 
        (SELECT COUNT(*) FROM recommendationLikes WHERE recommendationId = ?) AS likeCount,
        (SELECT COUNT(*) FROM recommendationLikes WHERE recommendationId = ?) AS dislikeCount`,
      [recommendationId, recommendationId]
    );

    res.json(likeCount);
  })
);
export default router;
