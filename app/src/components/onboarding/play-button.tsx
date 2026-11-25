"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { basicButtonStyles } from "@/components/ui/button-classes";
import { useToast } from "@/components/ui/toast";
import { selectGuest } from "@/lib/floor-store";

export function PlayButton() {
  const router = useRouter();
  return (
    <Link
      href="/table"
      prefetch={false}
      className={`${basicButtonStyles("sun", "lg")} min-w-36`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
          return;
        event.preventDefault();
        void import("@/lib/guest")
          .then(({ createGuest }) => {
            selectGuest(createGuest());
            router.push("/table");
          })
          .catch((error: unknown) => {
            void import("@/lib/errors").then(({ friendlyError }) =>
              useToast.getState().add(friendlyError(error)),
            );
          });
      }}
    >
      Play as guest <span aria-hidden>→</span>
    </Link>
  );
}
