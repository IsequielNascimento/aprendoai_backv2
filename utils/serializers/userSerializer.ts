import { Prisma } from "@/generated/prisma/browser";

type dataUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;

  collection: Prisma.CollectionModel[];
}

export const UserSerializer = (user: dataUser) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  collection: user.collection,
});