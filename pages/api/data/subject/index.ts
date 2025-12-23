import { createSubject, fetchSubjects, fetchSubject } from "@/controllers/subject"; // ADICIONEI fetchSubject
import { verifyToken } from "@/utils/jwt";
import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function Handle(req: NextApiRequest, res: NextApiResponse) {
  const { authorization } = req.headers;
  const guard = verifyToken(authorization?.toString() || "");

  if (!guard.isValid) return res.status(401).json({ message: 'Unauthorized', error: true });

  switch (req.method) {
    case 'GET': {
      // 1. Tenta ler ID (Detalhes) ou CollectionId (Lista)
      const id = Number(req.query.id);
      const collectionId = Number(req.query.collectionId);

      // CASO 1: Se tiver ID, busca os detalhes do assunto (Conversas, Quiz, etc)
      if (!isNaN(id)) {
        const response = await fetchSubject(id);
        return res.status(response?.statusCode).json(response);
      }
      
      // CASO 2: Se tiver CollectionId, lista todos os assuntos daquela pasta
      else if (!isNaN(collectionId)) {
        const response = await fetchSubjects(collectionId);
        return res.status(response?.statusCode).json(response);
      }

      // CASO 3: Nenhum dos dois foi enviado
      return res.status(400).json({ message: 'ID ou CollectionID necessário', error: true });
    }

    case 'POST': {
      const form = formidable({
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024,
        allowEmptyFiles: true,
        minFileSize: 0,
      });

      try {
        const data: any = await new Promise((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
          });
        });

        const name = Array.isArray(data.fields.name) ? data.fields.name[0] : data.fields.name;
        const collectionId = Array.isArray(data.fields.collectionId) ? data.fields.collectionId[0] : data.fields.collectionId;

        let imageBase64 = null;
        const file = data.files.file?.[0] || data.files.file;

        if (file) {
          const fileData = fs.readFileSync(file.filepath);
          imageBase64 = `data:${file.mimetype};base64,${fileData.toString('base64')}`;
        }

        const subjectData = {
          name: name,
          collectionId: Number(collectionId),
          image: imageBase64,
        };

        const response = await createSubject(subjectData);
        return res.status(response?.statusCode || 201).json(response);

      } catch (error) {
        console.error("Erro no upload subject:", error);
        return res.status(500).json({ message: 'Erro interno no upload', error: true });
      }
    }

    // Se o seu app Flutter usa PUT para gerar quiz, adicione o case PUT aqui também
    // (Baseado no seu código anterior de createQuestions)
    case 'PUT': {
       // Se precisar reativar a lógica de gerar quiz via PUT, insira aqui.
       // Caso contrário, retorna 405.
       return res.status(405).json({ message: 'Method Not Allowed', error: true });
    }

    default:
      return res.status(405).json({ message: 'Method Not Allowed', error: true });
  }
}