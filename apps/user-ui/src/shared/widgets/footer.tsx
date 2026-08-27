import Link from "next/link";
import { Mail, MapPin, MessageCircle, Share2, Users } from "lucide-react";

const Footer = () => {
  return (
    <footer className="mt-16 bg-[#f4f6f8] text-[#1b2733]">
      <div className="mx-auto grid w-[90%] max-w-[1280px] gap-10 py-14 md:w-[80%] md:grid-cols-4 md:gap-8">
        <div>
          <p className="max-w-[240px] text-sm leading-6 text-slate-600">
            Perfect ecommerce platform to start your business from scratch
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link href="#" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition hover:bg-[#3489FF] hover:text-white">
              <Share2 size={17} />
            </Link>
            <Link href="#" aria-label="Twitter" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition hover:bg-[#3489FF] hover:text-white">
              <MessageCircle size={17} />
            </Link>
            <Link href="#" aria-label="LinkedIn" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition hover:bg-[#3489FF] hover:text-white">
              <Users size={17} />
            </Link>
          </div>
        </div>

        <div>
          <h2 className="mb-5 text-lg font-semibold">My Account</h2>
          <nav className="space-y-3 text-sm text-slate-600" aria-label="Account">
            <Link className="block transition hover:text-[#3489FF]" href="/track-order">Track Orders</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/shipping">Shipping</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/wishlist">Wishlist</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/profile">My Account</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/orders">Order History</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/returns">Returns</Link>
          </nav>
        </div>

        <div>
          <h2 className="mb-5 text-lg font-semibold">Information</h2>
          <nav className="space-y-3 text-sm text-slate-600" aria-label="Information">
            <Link className="block transition hover:text-[#3489FF]" href="/our-story">Our Story</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/careers">Careers</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/privacy-policy">Privacy Policy</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/terms">Terms &amp; Conditions</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/news">Latest News</Link>
            <Link className="block transition hover:text-[#3489FF]" href="/contact">Contact Us</Link>
          </nav>
        </div>

        <div>
          <h2 className="mb-5 text-lg font-semibold">Talk To Us</h2>
          <p className="text-sm text-slate-600">Got Questions? Call us</p>
          <a className="mt-2 block text-xl font-bold" href="tel:+67041390762">+670 413 90 762</a>
          <a className="mt-4 flex items-center gap-2 text-sm text-slate-600 transition hover:text-[#3489FF]" href="mailto:support@eshop.com">
            <Mail size={17} />
            support@eshop.com
          </a>
          <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <MapPin className="mt-1 shrink-0" size={17} />
            <span>79 Sleepy Hollow St.<br />Jamaica, New York 1432</span>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        © 2025 All Rights Reserved | Becodemy Private Ltd
      </div>
    </footer>
  );
};

export default Footer;