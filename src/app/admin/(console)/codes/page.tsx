import { toggleDiscountCodeAction } from "@/app/actions/admin";
import { DiscountCodeForm } from "@/components/admin/discount-code-form";
import { PanelHeading, PanelNote } from "@/components/admin/panel";
import { Button } from "@/components/ui/button";
import { listDiscountOffers } from "@/lib/discount-codes";
import { discountOfferLabel } from "@/lib/discounts";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-messages";

export const metadata = { title: "Discounts" };

export default async function AdminDiscountCodesPage() {
  const loaded = await listDiscountOffers();

  return (
    <>
      <PanelHeading
        title="Discounts"
        body="A host enters the code on the plan card before pay. PayMongo then charges the lower amount and shows the original price in the description. A use is counted only after the payment is confirmed."
      />
      {!loaded.ok ? (
        <PanelNote>
          {loaded.missing
            ? ADMIN_ERROR_MESSAGES.missingSchema
            : "Could not load discount codes."}
        </PanelNote>
      ) : loaded.offers.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {loaded.offers.map((offer) => (
            <li
              key={offer.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <p className="text-sm">{discountOfferLabel(offer)}</p>
              <form action={toggleDiscountCodeAction}>
                <input type="hidden" name="id" value={offer.id} />
                <input
                  type="hidden"
                  name="active"
                  value={offer.active ? "false" : "true"}
                />
                <Button type="submit" size="sm" variant="outline">
                  {offer.active ? "Turn off" : "Turn on"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <PanelNote>No discount codes yet.</PanelNote>
      )}
      <section className="max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-4 text-lg font-semibold">New code</h2>
        <DiscountCodeForm />
      </section>
    </>
  );
}
