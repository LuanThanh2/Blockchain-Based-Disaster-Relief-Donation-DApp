"use client";
import { Heart, MapPin, ImageIcon, Search } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

interface ReliefCard {
    _id: string;
    reliefName: string;
    location: {
        city: string;
        state: string;
    };
    description: string;
    coverImage: string;
    slug: string;
}

export default function ReliefCards() {
    const [reliefs, setReliefs] = useState<ReliefCard[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [filteredReliefs, setFilteredReliefs] = useState<ReliefCard[]>([]);
    const router = useRouter();

    useEffect(() => {
        const fetchReliefs = async () => {
            try {
                const response = await fetch(apiUrl("/api/v1/reliefDetails/public-relief-cards"));
                const result = await response.json();

                if (!response.ok) {
                    console.error("Error fetching reliefs:", result.message);
                    setReliefs([]);
                    return;
                }

                setReliefs(result.data);
                setFilteredReliefs(result.data);
            } catch (error) {
                console.error("Failed to fetch reliefs:", error);
            }
        };

        fetchReliefs();
    }, []);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        const filtered = reliefs.filter((relief) =>
            relief.reliefName.toLowerCase().includes(value.toLowerCase()) ||
            relief.location.city.toLowerCase().includes(value.toLowerCase()) ||
            relief.location.state.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredReliefs(filtered);
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Explore Reliefs</h1>
                    <p className="text-muted-foreground">Discover and support relief efforts across India with transparent donations</p>
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder="Search reliefs..."
                    className="px-4 py-2 border border-gray-300 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-orange-600"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReliefs.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 text-lg">
                        No reliefs available at the moment.
                    </div>
                ) : (
                    filteredReliefs.map((relief) => (
                        <div
                            key={relief._id}
                            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
                        >
                            <div className="relative">
                                {relief.coverImage ? (
                                    <img src={relief.coverImage} alt={relief.reliefName} className="w-full h-48 object-cover" />
                                ) : (
                                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                )}
                            </div>

                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-lg text-gray-900 truncate pr-2">{relief.reliefName}</h3>
                                    <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                        <Heart className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                    </button>
                                </div>

                                <div className="flex items-center text-sm text-gray-600 mb-3">
                                    <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                                    <span className="truncate">
                                        {relief.location.city}, {relief.location.state}
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                                    {relief.description}
                                </p>

                                <div className="flex gap-2">
                                    <Link href={`/reliefs/${relief.slug}`}>
                                        <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium">
                                            View Details
                                        </button>
                                    </Link>

                                    <Link href={`/reliefs/${relief.slug}`} className="flex-1">
                                        <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium">
                                            View
                                        </button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
