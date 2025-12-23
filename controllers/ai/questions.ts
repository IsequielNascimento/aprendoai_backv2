import { GoogleGenAI, Schema, Type } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { createQuestion } from "../questions";

// Recomendado: Em Next.js, use um singleton para o Prisma para evitar "Too many connections"
// import prisma from "@/lib/prisma"; 
const prisma = new PrismaClient(); 

export const iaQuestions = async (id: number, userId: number, count: number = 5, itemCount: number = 4): Promise<any> => {
    try {
        // Inicializa a nova SDK do Google GenAI
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

        // 1. Busca os dados do Assunto (Subject)
        const subjectData = await prisma.subject.findUnique({
            where: { id },
            select: {
                name: true,
                resume: true,
                collection: { select: { userId: true } },
                conversation: { 
                    orderBy: { createdAt: 'asc' },
                    select: { text: true, isGenerated: true },
                    take: 20 // Limita o histórico para não estourar tokens desnecessariamente
                }
            }
        });

        // 2. Validação de Segurança
        if (!subjectData || subjectData.collection.userId !== userId) {
            return { statusCode: 401, message: 'Unauthorized or Subject not found', error: true };
        }
        
        // 3. Formatação do Contexto
        const conversationHistory = subjectData.conversation
            .map(msg => `[${msg.isGenerated ? 'Tutor' : 'Student'}] ${msg.text}`)
            .join('\n');
            
        const contentToAnalyze = (subjectData.resume && subjectData.resume.length > 50)
            ? `RESUMO PRINCIPAL:\n${subjectData.resume}\n\nHISTÓRICO DE CONVERSA (Contexto Adicional):\n${conversationHistory}`
            : `HISTÓRICO DE CONVERSA:\n${conversationHistory}`;

        if (contentToAnalyze.length < 50) {
            return { 
                statusCode: 200, 
                message: "Conteúdo insuficiente para gerar questões.", 
                questionsGenerated: 0 
            };
        }

        // 4. Definição do Schema (Estrutura JSON esperada)
        const QuestionItemSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                text: {
                    type: Type.STRING,
                    description: "O texto da opção de múltipla escolha.",
                },
                isCorrect: {
                    type: Type.BOOLEAN,
                    description: "True se esta for a resposta correta, False caso contrário.",
                },
            },
            required: ["text", "isCorrect"],
        };

        const QuestionListSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                questions: {
                    type: Type.ARRAY,
                    description: `Uma lista contendo exatamente ${count} questões.`,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: {
                                type: Type.STRING,
                                description: "O enunciado da pergunta.",
                            },
                            items: {
                                type: Type.ARRAY,
                                description: `Uma lista com exatamente ${itemCount} opções de resposta.`,
                                items: QuestionItemSchema,
                            },
                        },
                        required: ["text", "items"],
                    },
                },
            },
            required: ["questions"],
        };

        // 5. Construção do Prompt
        const prompt = `
        Você é um Criador de Avaliações Acadêmicas.
        Tópico: ${subjectData.name}
        
        Instruções:
        1. Gere **${count} perguntas de múltipla escolha** baseadas no conteúdo abaixo.
        2. Cada pergunta deve ter **exatamente ${itemCount} opções** ('items').
        3. Apenas uma opção deve ser verdadeira ('isCorrect: true').
        4. O objetivo é testar a compreensão e retenção dos conceitos.
        
        Conteúdo para Análise:
        --- INÍCIO ---
        ${contentToAnalyze}
        --- FIM ---
        
        Responda estritamente com o JSON conforme o Schema.
        `;

        // 6. Chamada à API do Gemini
        const result = await ai.models.generateContent({
            model: "gemma-3-12b", // Modelo estável e rápido (ou use gemini-2.0-flash-exp)
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: QuestionListSchema,
                temperature: 0.3, // Temperatura baixa para respostas mais determinísticas
            }
        });

        const questionsJsonString = result?.text;

        if (!questionsJsonString) {
            console.error("Gemini retornou texto vazio.");
            return { statusCode: 500, message: "Erro na geração da IA (Resposta vazia).", error: true };
        }

        // 7. Parse e Validação
        let questionsObject;
        try {
            questionsObject = JSON.parse(questionsJsonString);
        } catch (jsonError) {
            console.error("Erro ao fazer parse do JSON:", questionsJsonString);
            return { statusCode: 500, message: "Falha ao processar resposta da IA.", error: true };
        }

        if (!questionsObject.questions || !Array.isArray(questionsObject.questions)) {
             return { statusCode: 500, message: "Formato de JSON inválido retornado pela IA.", error: true };
        }

        // 8. Salvar no Banco de Dados
        const createdQuestions = [];

        for (const q of questionsObject.questions) {
            // Validação simples para garantir que temos opções
            if (!q.items || q.items.length === 0) continue;

            const questionData = {
                subjectId: id,
                text: q.text,
                items: JSON.stringify(q.items), // O Prisma espera String/JSON aqui
            };

            const newQuestion = await createQuestion(questionData as any);
            createdQuestions.push(newQuestion);
        }

        return { 
            statusCode: 200, 
            message: `${createdQuestions.length} questões geradas com sucesso.`,
            questions: createdQuestions
        };

    } catch (error) {
        console.error("ERRO FATAL em iaQuestions:", error); 
        return { statusCode: 500, message: "Erro Interno do Servidor", error: true };    
    }
};