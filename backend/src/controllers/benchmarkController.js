import { asyncHandler } from "../utils/asyncHandler.js";
import { computeBenchmarkForUser } from "../services/benchmarkService.js";

export const getMyBenchmark = asyncHandler(async (req, res) => {
  const benchmark = await computeBenchmarkForUser(req.user._id);
  res.status(200).json({
    success: true,
    benchmark
  });
});
