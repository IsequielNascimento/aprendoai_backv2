import { deleteUser, fetchUser, updateUser } from "@/controllers/user";
import { verifyToken } from "@/utils/jwt";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function Handle(req: NextApiRequest, res: NextApiResponse) {
  const { authorization } = req.headers;

  const guard = verifyToken(authorization?.toString() || "");

  if(!guard.isValid) return res.status(401).json({message: 'Unauthorized', error: true});

  const userId = guard.user.id

  switch(req.method) {
    case 'GET': {
      const response = await fetchUser(Number(userId));

      return res.status(response?.statusCode).json(response)
    }

    case 'PUT': {
      const response = await updateUser(req.body, Number(userId));
      
      return res.status(response?.statusCode).json(response)
    }

    case 'DELETE': {
      const response = await deleteUser(Number(userId));
      
      return res.status(response?.statusCode).json(response)
    }

    default: {
      return res.status(405).json({message: 'Method Not Allowed', error: true})
    }
  }
}