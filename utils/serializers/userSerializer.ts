import { Prisma } from "@prisma/client";

type DataUser = Prisma.UserGetPayload<{
  include: { collection: true };
}>;

export const UserSerializer = (user: DataUser) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  collection: user.collection,
});
