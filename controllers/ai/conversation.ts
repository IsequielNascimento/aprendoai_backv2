import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import prisma from "../../lib/prisma";
import { createConversation } from "../conversation";

export const guidedStudy = async (subjectId: number, userId: number): Promise<any> => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || "");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); 

        const subjectData = await prisma.subject.findUnique({
            where: { id: subjectId },
            select: {
                name: true,
                resume: true,
                collection: { select: { name: true, userId: true } },
                conversation: { 
                    orderBy: { createdAt: 'asc' },
                    select: { text: true, isGenerated: true }
                },
                question: { select: { text: true } }
            }
        });

        if (!subjectData) {
            return { statusCode: 404, message: 'Subject not found', error: true };
        }
        
        if (subjectData.collection.userId !== userId) {
            return { statusCode: 401, message: 'Unauthorized', error: true };
        }

        const subjectTitle = subjectData.name;
        const collectionTitle = subjectData.collection.name;

        const summaryContent = subjectData.resume && subjectData.resume.length > 0
            ? subjectData.resume
            : `The main study topic is: **${subjectTitle}**. You do not have pre-written summary content, so use your internal knowledge about this subject to guide the session.`;

        // Definimos explicitamente que 'q' é um objeto com uma string 'text'
        const formattedQuestions = subjectData.question.length > 0
            ? `- ${subjectData.question.map((q: { text: string }) => q.text).join('\n- ')}`
            : 'No specific test questions were provided. Please create your own questions and exercises to test the user.';

        interface ConversationMessage {
            text: string;
            isGenerated: boolean;
        }

        const history = subjectData.conversation.map((msg: ConversationMessage) => 
            `${msg.isGenerated ? 'Tutor' : 'User'}: ${msg.text}`
        ).join('\n') || "No prior conversation history. Start the session.";

        const prompt = `You are an Intelligent Guided Study Tutor, specialized in creating interactive and personalized conversation sessions.

          1. **Topic and Context:**
            **Topic:** ${subjectTitle}
            **Collection:** ${collectionTitle}

          2. **Reference Material (Summary):**
          ${summaryContent}

          3. **Question Instructions:**
          ${formattedQuestions}

          4. **Prior Conversation History (Maintain context):**
          --- History Start ---
          ${history}
          --- History End ---

          5. **Main Action Instructions (Highest Priority):**
              * **Help Mechanism (Fallback):** If the user shows **persistent difficulty** (e.g., after two incorrect attempts or by explicitly asking for help with phrases like "I don't know" or "I'm stuck"), you must **stop the Socratic questioning**. 
                  * **Action:** Immediately provide the **correct solution/answer** or the **next step** clearly. 
                  * **Justification:** After giving the answer, offer a **concise explanation** of the reasoning to ensure learning.
                  * **Transition:** Then, ask the user if they want to try a new example to reinforce the concept or if they prefer to move on to the next subtopic.
              * **Session Start:** If the history is empty, begin with a greeting and ask the user to specify which aspect of the topic they want to focus on.
              * **Tone:** Always be encouraging, academic, and constructive. Keep the conversation focused.
              
          Your next response (and only the next response) must be:`;

        const result = await model.generateContent(prompt);
        const aiResponseText = result.response.text();

        const iaConversation = { 
            text: aiResponseText, 
            isGenerated: true, 
            subjectId: subjectId 
        } as any;
        
        const conversation2 = await createConversation(iaConversation);

        return conversation2;
        
    } catch(error) {
        console.error("Error in guidedStudy:", error);
        return { statusCode: 500, message: "Internal Server Error", error: true };    
    }
}