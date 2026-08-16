import { describe,expect,it } from "vitest";
import { AegisApiError } from "@aegis/api-client";
import { normalizeError } from "./errors";
describe("normalizeError",()=>{it("marks expired sessions as unauthorized",()=>{expect(normalizeError(new AegisApiError(401,{code:"SESSION_EXPIRED",message:"Expired"}))).toMatchObject({unauthorized:true,retryable:false})});it("keeps unknown failures actionable",()=>{expect(normalizeError(new Error("Offline"))).toMatchObject({message:"Offline",retryable:true})})});
