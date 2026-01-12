import jwt from "jsonwebtoken";

export const generateToken = (user, res) => {
  const payload = {
    userId: user.id,
    role_id: user.role_id,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });


  res.cookie("lja_hris_token", token, {
    httpOnly: true, // Prevents JavaScript from reading the cookie (Security)

    secure: process.env.NODE_ENV !== "development",

    // 'strict' is best for same-domain, 'lax' is okay for dev
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "strict",

    maxAge: 24 * 60 * 60 * 1000, 
  });

  return token;
};
