"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";
import { ImageIcon, MapPin, Phone, Mail, Globe, Instagram, Facebook } from "lucide-react";

interface ReliefDetail {
    reliefName: string;
    slug: string;
    coverImage: string;
    location: {
        address: string;
        city: string;
        state: string;
        country: string;
    };
    activitiesAndServices: string[];
    darshanTimings: {
        morning?: string;
        evening?: string;
    };
    specialCeremonies: {
        name: string;
        dateTime: string;
    }[];
    upcomingEvents: {
        title: string;
        description: string;
        eventDate: string;
    }[];
    photoGallery: string[];
    description: string;
    history: string;
    contactDetails: {
        phone?: string;
        email?: string;
        facebook?: string;
        instagram?: string;
        website?: string;
    };
}

export default function ReliefDetailsPage() {
    const { slug } = useParams();
    const router = useRouter();
    const [relief, setRelief] = useState<ReliefDetail | null>(null);

    useEffect(() => {
        const fetchRelief = async () => {
            try {
                const response = await fetch(apiUrl(`/api/v1/Details/get-relief-by-slug/${slug}`));
                const result = await response.json();
                if (response.ok) {
                    setRelief(result.data);
                } else {
                    console.error(result.message);
                }
            } catch (error) {
                console.error("Error fetching relief:", error);
            }
        };
        fetchRelief();
    }, [slug]);

    if (!relief) {
        return <div className="p-6 text-center text-gray-600">Loading relief details...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                {relief.coverImage ? (
                    <img src={relief.coverImage} alt={relief.reliefName} className="w-full h-64 object-cover" />
                ) : (
                    <div className="h-64 bg-gray-200 flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-gray-400" />
                    </div>
                )}

                <div className="p-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">{relief.reliefName}</h1>
                    <div className="flex items-center text-gray-600 mb-4">
                        <MapPin className="w-5 h-5 mr-1" />
                        {relief.location.city}, {relief.location.state} - {relief.location.country}
                    </div>

                    <h2 className="text-xl font-semibold mb-2">Description</h2>
                    <p className="text-gray-700 mb-4">{relief.description}</p>

                    <h2 className="text-xl font-semibold mb-2">History</h2>
                    <p className="text-gray-700 mb-4">{relief.history}</p>

                    <h2 className="text-xl font-semibold mb-2">Darshan Timings</h2>
                    <ul className="list-disc pl-5 text-gray-700 mb-4">
                        {relief.darshanTimings.morning && <li>Morning: {relief.darshanTimings.morning}</li>}
                        {relief.darshanTimings.evening && <li>Evening: {relief.darshanTimings.evening}</li>}
                    </ul>

                    <h2 className="text-xl font-semibold mb-2">Activities & Services</h2>
                    <ul className="list-disc pl-5 text-gray-700 mb-4">
                        {relief.activitiesAndServices.map((service, index) => (
                            <li key={index}>{service}</li>
                        ))}
                    </ul>

                    {/* Special Ceremonies */}
                    {relief.specialCeremonies.length > 0 && (
                        <>
                            <h2 className="text-xl font-semibold mb-2">Special Ceremonies</h2>
                            <ul className="list-disc pl-5 text-gray-700 mb-4">
                                {relief.specialCeremonies.map((ceremony, index) => (
                                    <li key={index}>
                                        {ceremony.name} on {new Date(ceremony.dateTime).toLocaleString()}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {/* Upcoming Events */}
                    {relief.upcomingEvents.length > 0 && (
                        <>
                            <h2 className="text-xl font-semibold mb-2">Upcoming Events</h2>
                            <ul className="space-y-2 mb-4">
                                {relief.upcomingEvents.map((event, index) => (
                                    <li key={index} className="text-gray-700 border p-3 rounded">
                                        <strong>{event.title}</strong> - {event.description} on{" "}
                                        {new Date(event.eventDate).toLocaleDateString()}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <h2 className="text-xl font-semibold mb-2">Photo Gallery</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                        {relief.photoGallery.map((url, index) => (
                            <img key={index} src={url} alt={`Gallery ${index}`} className="w-full h-40 object-cover rounded-md" />
                        ))}
                    </div>

                    <h2 className="text-xl font-semibold mb-2">Contact</h2>
                    <ul className="text-gray-700 space-y-1 mb-6">
                        {relief.contactDetails.phone && (
                            <li className="flex items-center">
                                <Phone className="w-4 h-4 mr-2" /> {relief.contactDetails.phone}
                            </li>
                        )}
                        {relief.contactDetails.email && (
                            <li className="flex items-center">
                                <Mail className="w-4 h-4 mr-2" /> {relief.contactDetails.email}
                            </li>
                        )}
                        {relief.contactDetails.website && (
                            <li className="flex items-center">
                                <Globe className="w-4 h-4 mr-2" />{" "}
                                <a href={relief.contactDetails.website} className="text-blue-600 underline" target="_blank">
                                    Website
                                </a>
                            </li>
                        )}
                        {relief.contactDetails.facebook && (
                            <li className="flex items-center">
                                <Facebook className="w-4 h-4 mr-2" />{" "}
                                <a href={relief.contactDetails.facebook} className="text-blue-600 underline" target="_blank">
                                    Facebook
                                </a>
                            </li>
                        )}
                        {relief.contactDetails.instagram && (
                            <li className="flex items-center">
                                <Instagram className="w-4 h-4 mr-2" />{" "}
                                <a href={relief.contactDetails.instagram} className="text-blue-600 underline" target="_blank">
                                    Instagram
                                </a>
                            </li>
                        )}
                    </ul>

                    <div className="flex justify-end">
                        <button
                            onClick={() => router.push("/reliefs")}
                            className="px-6 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition"
                        >
                            Back to Reliefs
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
