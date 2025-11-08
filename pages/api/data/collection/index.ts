import { verifyToken } from "@/utils/jwt";
import type { NextApiRequest, NextApiResponse } from "next";
import { createCollection, deleteCollection, fetchCollections, updateCollection } from "@/controllers/collection";

export default async function Handle(req: NextApiRequest, res: NextApiResponse) {
  const { authorization } = req.headers;

  const guard = verifyToken(authorization?.toString() || "");

  if(!guard.isValid) return res.status(401).json({message: 'Unauthorized', error: true});

  const userId = Number(guard.user.id) || -1

  if(userId === -1) return res.status(401).json({message: 'Unauthorized', error: true});

  switch(req.method) {
    case 'GET': {
      const response = await fetchCollections(Number(userId));

      return res.status(response?.statusCode).json(response)
    }

    case 'POST': {
      const response = await createCollection({...req.body, userId});

      return res.status(response?.statusCode).json(response)
    }

    default: {
      return res.status(405).json({message: 'Method Not Allowed', error: true})
    }
  }
}