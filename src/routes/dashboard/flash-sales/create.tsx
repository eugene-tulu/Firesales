import { api } from '@convex/_generated/api';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useAction, useMutation } from 'convex/react';
import { ArrowLeft, Check, ChefHat, Flame, Loader2, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

export const Route = createFileRoute('/dashboard/flash-sales/create')({
  component: CreateDrop,
  beforeLoad: ({ context }) => {
    if (typeof window !== 'undefined') return;
    if (!context.isAuthenticated) throw redirect({ to: '/login' });
  },
});

type DropDraft = {
  sourceUrl: string;
  dropTitle: string;
  menuName: string;
  price: string;
  description: string;
  imageUrl: string;
  capacity: string;
  pickupDetails: string;
  chefNote: string;
  waitlistOpen: boolean;
};

const emptyDraft: DropDraft = {
  sourceUrl: '',
  dropTitle: '',
  menuName: '',
  price: '',
  description: '',
  imageUrl: '',
  capacity: '40',
  pickupDetails: '',
  chefNote: '',
  waitlistOpen: true,
};

function toCents(value: string) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function CreateDrop() {
  const navigate = useNavigate();
  const createProduct = useMutation(api.products.create);
  const createDrop = useMutation(api.flashSales.create);
  const researchSource = useAction(api.firecrawl.researchChefSource);

  const [draft, setDraft] = useState<DropDraft>(emptyDraft);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);

  const update = <Key extends keyof DropDraft>(key: Key, value: DropDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const importSource = async () => {
    if (!draft.sourceUrl.trim()) {
      setError('Paste a public menu, venue, or booking URL first.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setSourceMessage(null);
    try {
      const result = await researchSource({ url: draft.sourceUrl.trim() });
      if (!result.success) {
        setError(result.error);
        return;
      }

      const facts = result.facts;
      setDraft((current) => ({
        ...current,
        sourceUrl: result.sourceUrl,
        dropTitle: current.dropTitle || facts.menuName || facts.chefName || '',
        menuName: current.menuName || facts.menuName || '',
        price: current.price || (facts.price !== undefined ? String(facts.price) : ''),
        description: current.description || facts.description || '',
        imageUrl: current.imageUrl || facts.imageUrl || '',
        pickupDetails:
          current.pickupDetails ||
          facts.pickupDetails ||
          [facts.location, facts.cuisine].filter(Boolean).join(' · '),
        chefNote:
          current.chefNote || (facts.chefName ? `A limited batch from ${facts.chefName}.` : ''),
      }));
      setSourceMessage(
        `Source imported. Review every detail before publishing${result.remainingFreeImports === 0 ? ' — that was your last complimentary import.' : ` (${result.remainingFreeImports} complimentary imports left)`}.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'Could not import that source.',
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const price = toCents(draft.price);
    const capacity = Number.parseInt(draft.capacity, 10);
    if (!draft.menuName.trim() || !draft.dropTitle.trim()) {
      setError('Give the drop and the menu item a name.');
      return;
    }
    if (!price) {
      setError('Set a valid price per plate.');
      return;
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError('Set a whole-number plate capacity.');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const productId = await createProduct({
        name: draft.menuName.trim(),
        price,
        description: draft.description.trim(),
        imageUrl: draft.imageUrl.trim(),
        sourceUrl: draft.sourceUrl.trim(),
      });
      const result = await createDrop({
        productId,
        allocatedInventory: capacity,
        dropTitle: draft.dropTitle.trim(),
        chefNote: draft.chefNote.trim() || undefined,
        pickupDetails: draft.pickupDetails.trim() || undefined,
        waitlistOpen: draft.waitlistOpen,
      });
      await navigate({
        to: '/dashboard/flash-sales/$saleId',
        params: { saleId: result.flashSaleId },
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create this drop.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl py-3 sm:py-8">
      <section className="page-atmosphere mb-7 flex flex-wrap items-start justify-between gap-5 rounded-[1.8rem] border border-primary/15 px-6 py-7 sm:mb-8 sm:px-8 sm:py-9">
        <div>
          <p className="text-kicker mb-3 flex items-center gap-2 text-xs font-bold text-primary">
            <ChefHat className="size-4" /> Chef drop studio
          </p>
          <h1 className="font-editorial text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
            Start with a menu. End with a guest list.
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
            Make one clear invitation: the plate, the batch you can cook beautifully, and the
            collection plan guests can trust.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-primary" /> This begins as a private draft. You decide
            when it opens.
          </p>
        </div>
        <Button variant="outline" asChild className="rounded-xl">
          <a href="/dashboard/flash-sales">
            <ArrowLeft className="mr-2 h-4 w-4" /> All drops
          </a>
        </Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="ember-panel h-fit rounded-[1.55rem] border-primary/20 py-0">
          <CardHeader>
            <p className="text-kicker text-[0.62rem] font-bold text-primary">Optional shortcut</p>
            <CardTitle className="mt-2 flex items-center gap-2 text-xl">
              <Sparkles className="h-4 w-4 text-primary" /> Let the web do the quiet admin
            </CardTitle>
            <CardDescription>
              Paste a public menu, booking, venue, or social page. We will bring back a draft for
              you to edit—not publish anything for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="source-url">Public source URL</Label>
            <Input
              id="source-url"
              type="url"
              value={draft.sourceUrl}
              onChange={(event) => update('sourceUrl', event.target.value)}
              placeholder="https://your-menu-or-booking-page.com"
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-xl"
              onClick={importSource}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reading source…
                </>
              ) : (
                'Make me a starting draft'
              )}
            </Button>
            {sourceMessage && <p className="text-sm text-muted-foreground">{sourceMessage}</p>}
            <p className="rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground">
              You are always the editor. Imports only fill a draft you control.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[1.55rem] py-0">
          <CardHeader>
            <p className="text-kicker text-[0.62rem] font-bold text-primary">Private draft</p>
            <CardTitle className="font-editorial mt-2 text-3xl font-bold tracking-[-0.04em]">
              Shape the invitation
            </CardTitle>
            <CardDescription>
              Keep the guest choice simple: one hero plate, one capacity, one collection plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drop-title">What is this little occasion called?</Label>
                  <Input
                    id="drop-title"
                    value={draft.dropTitle}
                    onChange={(event) => update('dropTitle', event.target.value)}
                    placeholder="Friday jollof supper"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-name">What is on the plate?</Label>
                  <Input
                    id="menu-name"
                    value={draft.menuName}
                    onChange={(event) => update('menuName', event.target.value)}
                    placeholder="Smoky chicken jollof plate"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Price per plate (KES)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(event) => update('price', event.target.value)}
                    placeholder="1800"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">How many plates can you make beautifully?</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.capacity}
                    onChange={(event) => update('capacity', event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Give people a reason to care</Label>
                <Textarea
                  id="description"
                  value={draft.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder="Describe the menu, dietary notes, and why this batch is worth arranging a week around."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pickup-details">Collection details</Label>
                  <Input
                    id="pickup-details"
                    value={draft.pickupDetails}
                    onChange={(event) => update('pickupDetails', event.target.value)}
                    placeholder="Saturday, 6–8pm · Westlands"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image-url">Hero image URL</Label>
                  <Input
                    id="image-url"
                    type="url"
                    value={draft.imageUrl}
                    onChange={(event) => update('imageUrl', event.target.value)}
                    placeholder="https://…/dish.jpg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="chef-note">A note from the chef</Label>
                <Textarea
                  id="chef-note"
                  value={draft.chefNote}
                  onChange={(event) => update('chefNote', event.target.value)}
                  placeholder="A short, human invitation. Why are you making this one?"
                  rows={3}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={draft.waitlistOpen}
                  onChange={(event) => update('waitlistOpen', event.target.checked)}
                />
                <span>
                  <span className="block font-semibold">Keep an encore list</span>
                  <span className="text-muted-foreground">
                    When this batch fills, let guests raise their hand for the next invitation.
                  </span>
                </span>
              </label>

              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20"
                size="lg"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating draft…
                  </>
                ) : (
                  <>
                    Save private draft <Flame className="ml-1 size-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Next you can review the invitation, then choose exactly when to open it.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
