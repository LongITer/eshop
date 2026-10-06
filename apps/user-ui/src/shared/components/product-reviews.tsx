'use client';
import { useId, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Send, ShieldCheck, Star } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import useUser from '@/hooks/useUser';
export default function ProductReviews({ productId }: { productId: string }) {
  const formId = useId();
  const [hoverRating, setHoverRating] = useState(0);
  const ratingLabels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { user } = useUser();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['reviews', productId, page], queryFn: async () => (await axios.get(`/product/api/product-reviews/${productId}?page=${page}`)).data });
  const save = useMutation({ mutationFn: () => axios.post('/product/api/create-review', { productId, rating, comment: comment.trim() }), onSuccess: () => { setComment(''); client.invalidateQueries({ queryKey: ['reviews', productId] }); } });
  return <section id="reviews" className="max-w-5xl mx-auto px-4 py-8 space-y-4"><h2 className="text-2xl font-semibold">Customer reviews</h2>{query.isLoading && <p>Loading reviews…</p>}{query.isError && <p role="alert">Could not load reviews.</p>}{query.data && <><p>{Number(query.data.rating).toFixed(1)} / 5 · {query.data.total} reviews</p>{!query.data.total && <p>No reviews yet.</p>}{query.data.reviews.map((review: any) => <article key={review.id} className="border rounded-lg p-4"><strong>{review.user.name}</strong><p aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p><p className="whitespace-pre-wrap">{review.comment}</p><time>{new Date(review.createdAt).toLocaleDateString()}</time></article>)}<div className="flex gap-4"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button disabled={page * 20 >= query.data.total} onClick={() => setPage(page + 1)}>Next</button></div></>}{user && <form className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" onSubmit={e => { e.preventDefault(); if (comment.trim() && !save.isPending) save.mutate(); }}>
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><MessageSquare size={22} aria-hidden="true" /></div>
        <div><h3 className="text-lg font-semibold tracking-tight text-slate-800">Share your experience</h3><p className="mt-1 text-sm leading-relaxed text-slate-500">Help other shoppers choose with confidence.</p></div>
      </div>
      <div className="space-y-6 p-5 sm:p-6">
        <fieldset disabled={save.isPending}>
          <legend className="mb-2 text-sm font-medium text-slate-700">How would you rate this product?</legend>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map(value => <label key={value} className={`relative ${save.isPending ? 'cursor-wait' : 'cursor-pointer'}`} onMouseEnter={() => { if (!save.isPending) setHoverRating(value); }}>
                <input type="radio" name={`${formId}-rating`} value={value} checked={rating === value} onChange={() => { setRating(value); save.reset(); }} className="peer sr-only" aria-label={`${value} ${value === 1 ? 'star' : 'stars'} — ${ratingLabels[value - 1]}`} />
                <span className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-amber-50 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-60"><Star size={30} strokeWidth={1.5} aria-hidden="true" className={`transition ${value <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-50 text-slate-300'}`} /></span>
              </label>)}
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{ratingLabels[(hoverRating || rating) - 1]}</span>
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${formId}-comment`} className="mb-2 block text-sm font-medium text-slate-700">Your review</label>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
            <textarea id={`${formId}-comment`} className="block min-h-36 w-full resize-y bg-transparent p-4 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60" placeholder="What did you like? Tell us about the quality, performance, and your experience using it…" required maxLength={3000} disabled={save.isPending} value={comment} aria-describedby={`${formId}-hint`} onChange={e => { setComment(e.target.value); save.reset(); }} />
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs text-slate-400"><span id={`${formId}-hint`}>A few helpful details can make a difference.</span><span>{comment.length.toLocaleString('en-US')} / 3,000</span></div>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-sm items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />You can add or update one review per product after your order has been delivered.</p>
          <button type="submit" disabled={save.isPending || !comment.trim()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">{save.isPending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}{save.isPending ? 'Submitting…' : 'Submit review'}</button>
        </div>
        {save.isError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{(save.error as any).response?.data?.message || 'Could not save review. Please try again.'}</p>}
        {save.isSuccess && <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={18} aria-hidden="true" />Thank you! Your review has been saved.</p>}
      </div>
    </form>}</section>;
}

