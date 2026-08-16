import { api } from "./client";
export const authApi = { login: api.login.bind(api), register: api.register.bind(api), logout: api.logout.bind(api), me: api.me.bind(api), forgotPassword: api.forgotPassword.bind(api), resetPassword: api.resetPassword.bind(api), verifyEmail: api.verifyEmail.bind(api), google: api.googleSignInStart.bind(api) };
