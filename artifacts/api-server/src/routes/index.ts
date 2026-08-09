import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiRouter from "./api";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(apiRouter);

export default router;
