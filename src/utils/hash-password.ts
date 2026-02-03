import bcrypt from "bcrypt";

const password = "123"; 

(async () => {
  const hash = await bcrypt.hash(password, 10);
  console.log("PASSWORD HASH:", hash);
})();
