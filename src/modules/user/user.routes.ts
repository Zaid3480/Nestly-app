import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/oauth/google", UserController.googleAuth);

router.post("/oauth/apple", UserController.appleAuth);



router.put(
  "/profile",
  authMiddleware,
  UserController.updateProfile
);

router.get(
  "/profile/:id",
  authMiddleware,
  UserController.getProfile
);


router.delete(
  "/profile/:id",
  authMiddleware,
  UserController.deleteProfile
);

router.post("/profile", authMiddleware, UserController.createProfile);



export default router;
