# Haki V3 setup

This version adds optional customer-profile features:

- Menu image uploads (multiple pages + swipe/arrow viewer)
- Optional WhatsApp, booking and Google Review buttons
- Merchant UPI ID -> Pay Now button using a UPI payment intent
- Optional payment QR shown at the bottom of the profile
- Only populated fields/features appear on the customer profile
- Browser-side image compression before upload to conserve Supabase storage
- Haki media stored in the `haki-media` public bucket
- Business deletion also attempts to remove that business's uploaded media

## Supabase

Run `supabase/haki_v3.sql` once in the Supabase SQL Editor after the existing Haki SQL files.

## Storage behaviour

Menu pages are converted to WebP and resized to a maximum dimension of 1600px before upload. Payment QR images are resized to a maximum dimension of 1000px and compressed at higher quality. This keeps storage usage low during the testing phase.

## Customer profile behaviour

- Phone present -> Call button
- Menu images present -> Menu button
- Instagram present -> Instagram button
- Website present -> Website button
- Google Review URL present -> Google Review button
- WhatsApp present -> WhatsApp button
- Booking URL present -> Booking button
- UPI ID present -> Pay Now button
- Payment QR present -> QR section at the bottom

The profile still supports the existing optional Facebook, LinkedIn, email and Save Contact functionality.
