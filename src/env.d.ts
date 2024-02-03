/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    suspended: import("./middleware").Suspended[];
  }
}
