"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { basicButtonStyles } from "@/components/ui/button-classes";
import { useToast } from "@/components/ui/toast";
import { selectGuest, updateFloor } from "@/lib/floor-store";

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
            // The floor takes a seat for this guest as soon as the table has loaded.
            updateFloor({ joinRequested: true });
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
