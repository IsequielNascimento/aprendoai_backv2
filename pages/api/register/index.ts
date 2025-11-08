import { createUser } from "@/controllers/user";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function Handle(req: NextApiRequest, res: NextApiResponse) {
  switch(req.method) {
    case 'POST': {
      const response = await createUser(req.body);
      return res.status(response?.statusCode).json(response)
    }

    default: {
      return res.status(405).json({message: 'Method Not Allowed', error: true})
    }
  }
}